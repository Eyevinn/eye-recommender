const keyBuilder = require("../helpers/keyBuilder");
const config = require("../helpers/config");
const _ = require("underscore");
const async = require("async");

class BaseRedisHandler {
  constructor({ redisClient }) {
    this.redisClient = redisClient;
  }

  async updateSequence(userId, itemId) {
    await this.updateSimilarityFor(userId);
    await Promise.all([
      this.updateWilsonScore(itemId, () => {}),
      this.updateRecommendationsFor(userId, () => {})
    ]);
  }

  async changeRating({
    userId,
    itemId,
    liked = undefined,
    removeRating = false
  }) {
    const updateRecommendations = true;

    const feelingItemSet = liked
      ? keyBuilder.itemLikedBySet(itemId)
      : keyBuilder.itemDislikedBySet(itemId);
    const feelingUserSet = liked
      ? keyBuilder.userLikedSet(userId)
      : keyBuilder.userDislikedSet(userId);
    const mostFeelingSet = liked
      ? keyBuilder.mostLiked()
      : keyBuilder.mostDisliked();

    const ratingAlreadyExist = await this.redisClient.sismemberAsync(
      feelingItemSet,
      userId
    );
    // If the rating doesn't exist add it
    if (!ratingAlreadyExist && !removeRating) {
      this.redisClient.zincrby(mostFeelingSet, 1, itemId);
    }
    // otherwise, and if noted to be removed, remove it
    if (ratingAlreadyExist && removeRating) {
      this.redisClient.zincrby(mostFeelingSet, -1, itemId);
    }

    (await removeRating)
      ? this.redisClient.sremAsync(feelingUserSet, itemId)
      : this.redisClient.saddAsync(feelingUserSet, itemId);

    (await removeRating)
      ? this.redisClient.sremAsync(feelingItemSet, userId)
      : this.redisClient.saddAsync(feelingItemSet, userId);

    const done = await this.redisClient.sismemberAsync(feelingItemSet, userId);

    if (updateRecommendations && done) {
      await this.updateSequence(userId, itemId);
      return;
    }
    return;
  }

  async jaccardCoefficient(userId1, userId2) {
    let similarity = 0;
    let finalJaccardScore = 0;
    let ratedInCommon = 0;

    const user1LikedSet = keyBuilder.userLikedSet(userId1);
    const user1DislikedSet = keyBuilder.userDislikedSet(userId1);
    const user2LikedSet = keyBuilder.userLikedSet(userId2);
    const user2DislikedSet = keyBuilder.userDislikedSet(userId2);

    const results1 = await this.redisClient.sinterAsync(
      user1LikedSet,
      user2LikedSet
    );
    const results2 = await this.redisClient.sinterAsync(
      user1DislikedSet,
      user2DislikedSet
    );
    const results3 = await this.redisClient.sinterAsync(
      user1LikedSet,
      user2DislikedSet
    );
    const results4 = await this.redisClient.sinterAsync(
      user1DislikedSet,
      user2LikedSet
    );

    similarity =
      results1.length + results2.length - results3.length - results4.length;

    ratedInCommon =
      results1.length + results2.length + results3.length + results4.length;

    finalJaccardScore = similarity / ratedInCommon;
    return finalJaccardScore;
  }

  // this function updates the similarity for one user versus all others. at scale this probably needs to be refactored to compare a user
  // against clusters of users instead of against all. every comparison will be a value between -1 and 1 representing simliarity.
  // -1 is exact opposite, 1 is exactly the same.
  async updateSimilarityFor(userId) {
    // turning the userId into a string. depending on the db they might send an object, in which it won't compare properly when comparing
    // to other users
    userId = String(userId);
    // initializing variables
    let itemLiked, itemDisliked, itemLikeDislikeKeys;
    // setting the redis key for the user's similarity set
    const similarityZSet = keyBuilder.similarityZSet(userId);

    const userRatedItemIds = await this.redisClient.sunionAsync(
      keyBuilder.userLikedSet(userId),
      keyBuilder.userDislikedSet(userId)
    );
    // if they have rated anything
    if (userRatedItemIds.length > 0) {
      // creating a list of redis keys to look up all of the likes and dislikes for a given set of items
      itemLikeDislikeKeys = _.map(userRatedItemIds, (itemId, key) => {
        // key for that item being liked
        itemLiked = keyBuilder.itemLikedBySet(itemId);
        // key for the item being disliked
        itemDisliked = keyBuilder.itemDislikedBySet(itemId);
        // returning an array of those keys
        return [itemLiked, itemDisliked];
      });
    }
    // flattening the array of all the likes/dislikes for the items a user rated
    itemLikeDislikeKeys = _.flatten(itemLikeDislikeKeys);

    const otherUserIdsWhoRated = await this.redisClient.sunionAsync(
      itemLikeDislikeKeys
    );
    async.each(otherUserIdsWhoRated, async otherUserId => {
      if (otherUserIdsWhoRated.length === 1 || userId === otherUserId) return;
      if (userId != otherUserId) {
        const jaccardScore = await this.jaccardCoefficient(userId, otherUserId);
        await this.redisClient.zaddAsync(
          similarityZSet,
          jaccardScore,
          otherUserId
        );
      }
    });
  }

  predictFor(userId, itemId) {
    userId = String(userId);
    itemId = String(itemId);
    let finalSimilaritySum = 0.0;
    let prediction = 0.0;
    const similarityZSet = keyBuilder.similarityZSet(userId);
    const likedBySet = keyBuilder.itemLikedBySet(itemId);
    const dislikedBySet = keyBuilder.itemDislikedBySet(itemId);

    return new Promise((resolve, reject) => {
      this.similaritySum(similarityZSet, likedBySet, result1 => {
        this.similaritySum(similarityZSet, dislikedBySet, result2 => {
          finalSimilaritySum = result1 - result2;
          this.redisClient.scard(likedBySet, (err, likedByCount) => {
            this.redisClient.scard(dislikedBySet, (err, dislikedByCount) => {
              prediction =
                finalSimilaritySum / parseFloat(likedByCount + dislikedByCount);
              if (isFinite(prediction)) {
                resolve(prediction);
              } else {
                resolve(0.0);
              }
            });
          });
        });
      });
    });
  }

  similaritySum(simSet, compSet, cb) {
    let similarSum = 0.0;
    this.redisClient.smembers(compSet, (err, userIds) => {
      async.each(
        userIds,
        (userId, callback) => {
          this.redisClient.zscore(simSet, userId, (err, zScore) => {
            const newScore = parseFloat(zScore) || 0.0;
            similarSum += newScore;
            callback();
          });
        },
        err => {
          cb(similarSum);
        }
      );
    });
  }

  // after the similarity is updated for the user, the users recommendations are updated
  // recommendations consist of a sorted set in Redis. the values of this set are
  // names of the items and the score is what eyeRecommender estimates that user would rate it
  // the values are generally not going to be -1 or 1 exactly because there isn't 100%
  // certainty.
  updateRecommendationsFor(userId, cb) {
    // turning the user input into a string so it can be compared properly
    userId = String(userId);
    // creating two blank arrays
    let setsToUnion = [];
    let scoreMap = [];
    // initializing the redis keys for temp sets, the similarity set and the recommended set
    const tempAllLikedSet = keyBuilder.tempAllLikedSet(userId);
    const similarityZSet = keyBuilder.similarityZSet(userId);
    const recommendedZSet = keyBuilder.recommendedZSet(userId);
    // returns an array of the users that are most similar within k nearest neighbors
    this.redisClient.zrevrange(
      similarityZSet,
      0,
      config.nearestNeighbors - 1,
      (err, mostSimilarUserIds) => {
        // returns an array of the users that are least simimilar within k nearest neighbors
        this.redisClient.zrange(
          similarityZSet,
          0,
          config.nearestNeighbors - 1,
          (err, leastSimilarUserIds) => {
            // iterate through the user ids to create the redis keys for all those users likes
            _.each(mostSimilarUserIds, (usrId, key) => {
              setsToUnion.push(keyBuilder.userLikedSet(usrId));
            });
            // if you want to factor in the least similar least likes, you change this in config
            // left it off because it was recommending items that every disliked universally
            _.each(leastSimilarUserIds, (usrId, key) => {
              setsToUnion.push(keyBuilder.userDislikedSet(usrId));
            });
            // if there is at least one set in the array, continue
            if (setsToUnion.length > 0) {
              setsToUnion.unshift(tempAllLikedSet);
              this.redisClient.sunionstore(setsToUnion, err => {
                // using the new array of all the items that were liked by people similar and disliked by people opposite, create a new set with all the
                // items that the current user hasn't already rated
                this.redisClient.sdiff(
                  tempAllLikedSet,
                  keyBuilder.userLikedSet(userId),
                  keyBuilder.userDislikedSet(userId),
                  (err, notYetRatedItems) => {
                    // with the array of items that user has not yet rated, iterate through all of them and predict what the current user would rate it
                    async.each(
                      notYetRatedItems,
                      (itemId, callback) => {
                        this.predictFor(userId, itemId).then(score => {
                          // push the score and item to the score map array.
                          scoreMap.push([score, itemId]);
                          callback();
                        });
                      },
                      // using score map which is an array of what the current user would rate all the unrated items,
                      // add them to that users sorted recommended set
                      err => {
                        this.redisClient.del(recommendedZSet, err => {
                          async.each(
                            scoreMap,
                            (scorePair, callback) => {
                              this.redisClient.zadd(
                                recommendedZSet,
                                scorePair[0],
                                scorePair[1],
                                err => {
                                  callback();
                                }
                              );
                            },
                            // after all the additions have been made to the recommended set,
                            err => {
                              this.redisClient.del(tempAllLikedSet, err => {
                                this.redisClient.zcard(
                                  recommendedZSet,
                                  (err, length) => {
                                    this.redisClient.zremrangebyrank(
                                      recommendedZSet,
                                      0,
                                      length - config.numOfRecsStore - 1,
                                      err => {
                                        cb();
                                      }
                                    );
                                  }
                                );
                              });
                            }
                          );
                        });
                      }
                    );
                  }
                );
              });
            } else {
              cb();
            }
          }
        );
      }
    );
  }

  // the wilson score is a proxy for 'best rated'. it represents the best finding the best ratio of likes and also eliminating
  // outliers. the wilson score is a value between 0 and 1.
  updateWilsonScore(itemId, callback) {
    // creating the redis keys for scoreboard and to get the items liked and disliked sets
    const scoreboard = keyBuilder.scoreboardZSet();
    const likedBySet = keyBuilder.itemLikedBySet(itemId);
    const dislikedBySet = keyBuilder.itemDislikedBySet(itemId);
    // used for a confidence interval of 95%
    const z = 1.96;
    // initializing variables to calculate wilson score
    let n, pOS, score;
    // getting the liked count for the item
    this.redisClient.scard(likedBySet, (err, likedResults) => {
      // getting the disliked count for the item
      this.redisClient.scard(dislikedBySet, (err, dislikedResults) => {
        // if the total count is greater than zero
        if (likedResults + dislikedResults > 0) {
          // set n to the sum of the total ratings for the item
          n = likedResults + dislikedResults;
          // set pOS to the num of liked results divided by the number rated
          // pOS represents the proportion of successes or likes in this case
          pOS = likedResults / parseFloat(n);
          // try the following equation
          try {
            // calculating the wilson score
            // http://www.evanmiller.org/how-not-to-sort-by-average-rating.html
            score =
              (pOS +
                (z * z) / (2 * n) -
                z * Math.sqrt((pOS * (1 - pOS) + (z * z) / (4 * n)) / n)) /
              (1 + (z * z) / n);
          } catch (e) {
            // if an error occurs, set the score to 0.0 and console log the error message.
            console.log(e.name + ": " + e.message);
            score = 0.0;
          }
          // add that score to the overall scoreboard. if that item already exists, the score will be updated.
          this.redisClient.zadd(scoreboard, score, itemId, err => {
            // call the final callback sent to the initial function.
            callback();
          });
        }
      });
    });
  }
}

module.exports = BaseRedisHandler;
