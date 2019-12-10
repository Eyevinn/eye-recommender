const keyBuilder = require("../helpers/keyBuilder");
const config = require("../helpers/config");
const _ = require("underscore");
const async = require("async");

class BaseRedisHandler {
  constructor({ redisClient }) {
    this.redisClient = redisClient;
  }

  updateSequence(userId, itemId) {
    const updateWilson = true;
    return new Promise((resolve, reject) => {
      this.updateSimilarityFor(userId, () => {
        async.parallel([
          (cb) => {
            this.updateWilsonScore(itemId, () => {
              cb(null);
            });
          },
          (cb) => {
            this.updateRecommendationsFor(userId, () => {
              cb(null);
            });
          }
        ],
        err => {
          if (err) { console.log("error", err); }
          resolve();
        });
      });
    });
  }

  changeRating({ userId, itemId, liked = undefined, removeRating = false }) {
    const updateRecommendations = true;

    const feelingItemSet = liked ? keyBuilder.itemLikedBySet(itemId) : keyBuilder.itemDislikedBySet(itemId);
    const feelingUserSet = liked ? keyBuilder.userLikedSet(userId) : keyBuilder.userDislikedSet(userId);
    const mostFeelingSet = liked ? keyBuilder.mostLiked() : keyBuilder.mostDisliked();

    return new Promise((resolve, reject) => {
      Promise.resolve().then(() => {
        // check if the rating is already stored
        return this.redisClient.sismemberAsync(feelingItemSet, userId);
      }).then((result) => {
        // only increment the most feeling set if it doesn't already exist
        if (result === 0 && !removeRating) {
          this.redisClient.zincrby(mostFeelingSet, 1, itemId);
        } else if (result > 0 && removeRating) {
          this.redisClient.zincrby(mostFeelingSet, -1, itemId);
        }
        return removeRating ? this.redisClient.sremAsync(feelingUserSet, itemId) :
          this.redisClient.saddAsync(feelingUserSet, itemId);
      }).then(() => {
        return removeRating ? this.redisClient.sremAsync(feelingItemSet, userId) :
          this.redisClient.saddAsync(feelingItemSet, userId);
      }).then(() => {
        return this.redisClient.sismemberAsync(feelingItemSet, userId);
      }).then((result) => {
        // only fire update sequence if requested by the user
        // and there are results to compare
        if (updateRecommendations && result > 0) {
          this.updateSequence(userId, itemId).then(() => {
            resolve();
          });
        } else {
          resolve();
        }
      });
    });
  }

  jaccardCoefficient(userId1, userId2, callback) {
    let similarity = 0;
    let finalJaccardScore = 0;
    let ratedInCommon = 0;

    const user1LikedSet = keyBuilder.userLikedSet(userId1);
    const user1DislikedSet = keyBuilder.userDislikedSet(userId1);
    const user2LikedSet = keyBuilder.userLikedSet(userId2);
    const user2DislikedSet = keyBuilder.userDislikedSet(userId2);

    // retrieving a set of the users likes incommon
    this.redisClient.sinter(user1LikedSet, user2LikedSet, (err, results1) => {
      // retrieving a set of the users dislike incommon
      this.redisClient.sinter(user1DislikedSet, user2DislikedSet, (err, results2) => {
        // retrieving a set of the users like and dislikes that they disagree on
        this.redisClient.sinter(user1LikedSet, user2DislikedSet, (err, results3) => {
          // retrieving a set of the users like and dislikes that they disagree on
          this.redisClient.sinter(user1DislikedSet, user2LikedSet, (err, results4) => {
            // calculating the sum of the similarities minus the sum of the disagreements
            similarity = (results1.length + results2.length - results3.length - results4.length);
            // calculating the number of movies rated incommon
            ratedInCommon = (results1.length + results2.length + results3.length + results4.length);
            // calculating the the modified jaccard score. similarity / num of comparisons made incommon
            finalJaccardScore = similarity / ratedInCommon;
            // calling the callback function passed to jaccard with the new score
            callback(finalJaccardScore);
          });
        });
      });
    });
  };

  // this function updates the similarity for one user versus all others. at scale this probably needs to be refactored to compare a user
  // against clusters of users instead of against all. every comparison will be a value between -1 and 1 representing simliarity.
  // -1 is exact opposite, 1 is exactly the same.
  updateSimilarityFor(userId, cb) {
    // turning the userId into a string. depending on the db they might send an object, in which it won't compare properly when comparing
    // to other users
    userId = String(userId);
    // initializing variables
    let userRatedItemIds, itemLiked, itemDisliked, itemLikeDislikeKeys;
    // setting the redis key for the user's similarity set
    const similarityZSet = keyBuilder.similarityZSet(userId);
    // creating a combined set with the all of a users likes and dislikes
    this.redisClient.sunion(keyBuilder.userLikedSet(userId), keyBuilder.userDislikedSet(userId), (err, userRatedItemIds) => {
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
      // builds one set of all the users who liked and disliked the same items
      this.redisClient.sunion(itemLikeDislikeKeys, (err, otherUserIdsWhoRated) => {
        // running in async parallel, going through the array of user ids who also rated the same things
        async.each(otherUserIdsWhoRated,
          // running a function on each item in the list
          (otherUserId, callback) => {
            // if there is only one other user or the other user is the same user
            if (otherUserIdsWhoRated.length === 1 || userId === otherUserId) {
              // then call the callback and exciting the similarity check
              callback();
            }
            // if the userid is not the same as the user
            if (userId !== otherUserId) {
              // calculate the jaccard coefficient for similarity. it will return a value between -1 and 1 showing the two users
              // similarity
              this.jaccardCoefficient(userId, otherUserId, (result) => {
                // with the returned similarity score, add it to a sorted set named above
                this.redisClient.zadd(similarityZSet, result, otherUserId, (err) => {
                  // call the async callback function once finished to indicate that the process is finished
                  callback();
                });
              });
            }
          },
          // once all the async comparisons have been made, call the final callback based to the original function
          function (err) {
            cb();
          }
        );
      });
    });
  };

  predictFor(userId, itemId) {
    userId = String(userId);
    itemId = String(itemId);
    let finalSimilaritySum = 0.0;
    let prediction = 0.0;
    const similarityZSet = keyBuilder.similarityZSet(userId);
    const likedBySet = keyBuilder.itemLikedBySet(itemId);
    const dislikedBySet = keyBuilder.itemDislikedBySet(itemId);

    return new Promise((resolve, reject) => {
      this.similaritySum(similarityZSet, likedBySet, (result1) => {
        this.similaritySum(similarityZSet, dislikedBySet, (result2) => {
          finalSimilaritySum = result1 - result2;
          this.redisClient.scard(likedBySet, (err, likedByCount) => {
            this.redisClient.scard(dislikedBySet, (err, dislikedByCount) => {
              prediction = finalSimilaritySum / parseFloat(likedByCount + dislikedByCount);
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
  };

  similaritySum(simSet, compSet, cb) {
    let similarSum = 0.0;
    this.redisClient.smembers(compSet, (err, userIds) => {
      async.each(userIds,
        (userId, callback) => {
          this.redisClient.zscore(simSet, userId, (err, zScore) => {
            const newScore = parseFloat(zScore) || 0.0;
            similarSum += newScore;
            callback();
          });
        },
        (err) => {
          cb(similarSum);
        }
      );
    });
  };

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
    this.redisClient.zrevrange(similarityZSet, 0, config.nearestNeighbors - 1, (err, mostSimilarUserIds) => {
      // returns an array of the users that are least simimilar within k nearest neighbors
      this.redisClient.zrange(similarityZSet, 0, config.nearestNeighbors - 1, (err, leastSimilarUserIds) => {
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
          this.redisClient.sunionstore(setsToUnion, (err) => {
            // using the new array of all the items that were liked by people similar and disliked by people opposite, create a new set with all the
            // items that the current user hasn't already rated
            this.redisClient.sdiff(tempAllLikedSet, keyBuilder.userLikedSet(userId), keyBuilder.userDislikedSet(userId), (err, notYetRatedItems) => {
              // with the array of items that user has not yet rated, iterate through all of them and predict what the current user would rate it
              async.each(notYetRatedItems,
                (itemId, callback) => {
                  this.predictFor(userId, itemId).then((score) => {
                    // push the score and item to the score map array.
                    scoreMap.push([score, itemId]);
                    callback();
                  });
                },
                // using score map which is an array of what the current user would rate all the unrated items,
                // add them to that users sorted recommended set
                (err) => {
                  this.redisClient.del(recommendedZSet, (err) => {
                    async.each(scoreMap,
                      (scorePair, callback) => {
                        this.redisClient.zadd(recommendedZSet, scorePair[0], scorePair[1], (err) => {
                          callback();
                        });
                      },
                      // after all the additions have been made to the recommended set,
                      (err) => {
                        this.redisClient.del(tempAllLikedSet, (err) => {
                          this.redisClient.zcard(recommendedZSet, (err, length) => {
                            this.redisClient.zremrangebyrank(recommendedZSet, 0, length - config.numOfRecsStore - 1, (err) => {
                              cb();
                            });
                          });
                        });
                      }
                    );
                  });
                }
              );
            });
          });
        } else {
          cb();
        }
      });
    });
  };

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
        if ((likedResults + dislikedResults) > 0) {
          // set n to the sum of the total ratings for the item
          n = likedResults + dislikedResults;
          // set pOS to the num of liked results divided by the number rated
          // pOS represents the proportion of successes or likes in this case
          pOS = likedResults / parseFloat(n);
          // try the following equation
          try {
            // calculating the wilson score
            // http://www.evanmiller.org/how-not-to-sort-by-average-rating.html
            score = (pOS + z * z / (2 * n) - z * Math.sqrt((pOS * (1 - pOS) + z * z / (4 * n)) / n)) / (1 + z * z / n);
          } catch (e) {
            // if an error occurs, set the score to 0.0 and console log the error message.
            console.log(e.name + ": " + e.message);
            score = 0.0;
          }
          // add that score to the overall scoreboard. if that item already exists, the score will be updated.
          this.redisClient.zadd(scoreboard, score, itemId, (err) => {
            // call the final callback sent to the initial function.
            callback();
          });
        }
      });
    });
  };

}

module.exports = BaseRedisHandler;
