const keyBuilder = require("../helpers/keyBuilder");
const config = require("../helpers/config");
const utilities = require("../helpers/utilities");
const async = require("async");

class BaseRedisHandler {
  constructor({ redisClient }) {
    this.redisClient = redisClient;
  }

  async _updateSequence(userId, itemId) {
    await this._updateSimilarityFor(userId);
    await Promise.all([
      this._updateWilsonScore(itemId),
      this._updateRecommendationsFor(userId)
    ]);
  }

  async _changeRating({
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

    const ratingAlreadyExist = await this.redisClient.sismember(
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
      ? await this.redisClient.srem(feelingUserSet, itemId)
      : await this.redisClient.sadd(feelingUserSet, itemId);

    (await removeRating)
      ? await this.redisClient.srem(feelingItemSet, userId)
      : await this.redisClient.sadd(feelingItemSet, userId);

    const done = await this.redisClient.sismember(feelingItemSet, userId);

    if (updateRecommendations && done) {
      await this._updateSequence(userId, itemId);
    }
  }

  /**
   * The Jaccard similarity index (sometimes called the Jaccard similarity coefficient)
   * compares members for two sets to see which members are shared and which are distinct.
   * It's a measure of similarity for the two sets of data, with a range from 0% to 100%.
   * The higher the percentage, the more similar the two populations
   *
   * @param {string} userId1
   * @param {string} userId2
   */
  async _jaccardCoefficient(userId1, userId2) {
    let similarity = 0;
    let finalJaccardScore = 0;
    let ratedInCommon = 0;

    const user1LikedSet = keyBuilder.userLikedSet(userId1);
    const user1DislikedSet = keyBuilder.userDislikedSet(userId1);
    const user2LikedSet = keyBuilder.userLikedSet(userId2);
    const user2DislikedSet = keyBuilder.userDislikedSet(userId2);

    // common likes
    const results1 = await this.redisClient.sinter(
      user1LikedSet,
      user2LikedSet
    );
    // common dislikes
    const results2 = await this.redisClient.sinter(
      user1DislikedSet,
      user2DislikedSet
    );
    // disagreements where user 1 likes things user 2 dislikes
    const results3 = await this.redisClient.sinter(
      user1LikedSet,
      user2DislikedSet
    );
    // disagreements where user 1 dislikes things user 2 likes
    const results4 = await this.redisClient.sinter(
      user1DislikedSet,
      user2LikedSet
    );

    // similarities minus disagreements
    similarity =
      results1.length + results2.length - results3.length - results4.length;

    // the amount of assets rated together
    ratedInCommon =
      results1.length + results2.length + results3.length + results4.length;

    finalJaccardScore = similarity / ratedInCommon;

    // If we get full scored match, adjust randomly
    // This way we get more randomization in nearest neighbors if multiple on max score
    if (finalJaccardScore === 1) {
      finalJaccardScore -= Math.random() * 0.00000000000001;
    } else if (finalJaccardScore === -1) {
      finalJaccardScore += Math.random() * 0.00000000000001;
    }
    return finalJaccardScore;
  }

  /**
   * Updates the similarities between the user versus all the others.
   * Value between -1 and 1.
   * -1 is exact opposite, 1 is exactly the same.
   *
   * @param {string} userId
   */
  async _updateSimilarityFor(userId) {
    userId = String(userId);
    let itemLiked;
    let itemDisliked;
    let itemLikeDislikeKeys = [];
    const similarityZSet = keyBuilder.similarityZSet(userId);

    // create a set with all likes and dislikes for this user
    const userRatedItemIds = await this.redisClient.sunion(
      keyBuilder.userLikedSet(userId),
      keyBuilder.userDislikedSet(userId)
    );
    if (userRatedItemIds.length > 0) {
      // create the keys to be called for all these to get the users that also rated those
      itemLikeDislikeKeys = userRatedItemIds.map(itemId => {
        itemLiked = keyBuilder.itemLikedBySet(itemId);
        itemDisliked = keyBuilder.itemDislikedBySet(itemId);
        return [itemLiked, itemDisliked];
      });
    }
    itemLikeDislikeKeys = utilities.flatten(itemLikeDislikeKeys);
    // get all the other users who has rated the same assets
    const otherUserIdsWhoRated = await this.redisClient.sunion(
      itemLikeDislikeKeys
    );
    async.each(otherUserIdsWhoRated, async otherUserId => {
      if (otherUserIdsWhoRated.length === 1 || userId === otherUserId) return;
      if (userId != otherUserId) {
        // get the similarities
        const jaccardScore = await this._jaccardCoefficient(
          userId,
          otherUserId
        );
        // save as a list with similarity scores
        await this.redisClient.zadd(
          similarityZSet,
          jaccardScore,
          otherUserId
        );
      }
    });
  }

  async _predictFor(userId, itemId) {
    userId = String(userId);
    itemId = String(itemId);
    let finalSimilaritySum = 0.0;
    let prediction = 0.0;
    const similarityZSet = keyBuilder.similarityZSet(userId);
    const likedBySet = keyBuilder.itemLikedBySet(itemId);
    const dislikedBySet = keyBuilder.itemDislikedBySet(itemId);

    const [result1, result2] = await Promise.all([
      this._similaritySum(similarityZSet, likedBySet),
      this._similaritySum(similarityZSet, dislikedBySet)
    ]);
    finalSimilaritySum = result1 - result2;
    const likedbyCount = await this.redisClient.scard(likedBySet);
    const dislikedByCount = await this.redisClient.scard(dislikedBySet);
    prediction =
      finalSimilaritySum / parseFloat(likedbyCount + dislikedByCount);
    return prediction;
  }

  async _similaritySum(simSet, compSet) {
    let similarSum = 0.0;
    const userIds = await this.redisClient.smembers(compSet);
    async.each(userIds, async userId => {
      const zScore = await this.redisClient.zscore(simSet, userId);
      const newScore = parseFloat(zScore) || 0.0;
      similarSum += newScore;
    });
    return similarSum;
  }

  /**
   * Save a recommendation set
   * Items and their score
   * Value between -1 and 1.
   *
   * @param {string} userId
   */
  async _updateRecommendationsFor(userId) {
    userId = String(userId);
    let setsToUnion = [];
    let scoreMap = [];
    const tempAllLikedSet = keyBuilder.tempAllLikedSet(userId);
    const similarityZSet = keyBuilder.similarityZSet(userId);
    const recommendedZSet = keyBuilder.recommendedZSet(userId);

    const mostSimilarUserIds = await this.redisClient.zrevrange(
      similarityZSet,
      0,
      config.nearestNeighbors - 1
    );

    const leastSimilarUserIds = await this.redisClient.zrange(
      similarityZSet,
      0,
      config.nearestNeighbors - 1
    );

    mostSimilarUserIds.forEach(usrId => {
      setsToUnion.push(keyBuilder.userLikedSet(usrId));
    });
    leastSimilarUserIds.forEach(usrId => {
      setsToUnion.push(keyBuilder.userDislikedSet(usrId));
    });

    if (setsToUnion.length > 0) {
      setsToUnion.unshift(tempAllLikedSet);
      await this.redisClient.sunionstore(setsToUnion);
      const notYetRatedItems = await this.redisClient.sdiff(
        tempAllLikedSet,
        keyBuilder.userLikedSet(userId),
        keyBuilder.userDislikedSet(userId)
      );
      // iterate through the items which the user hasn't rated yet
      // and predict what they would think about thos
      async.each(
        notYetRatedItems,
        async itemId => {
          const score = await this._predictFor(userId, itemId);
          scoreMap.push([score, itemId]);
        },
        async () => {
          // add these predictions to that users recommended set
          await this.redisClient.del(recommendedZSet);
          async.each(
            scoreMap,
            async scorePair => {
              await this.redisClient.zadd(
                recommendedZSet,
                scorePair[0],
                scorePair[1]
              );
            },
            async () => {
              await this.redisClient.del(tempAllLikedSet);
              const length = await this.redisClient.zcard(recommendedZSet);
              await this.redisClient.zremrangebyrank(
                recommendedZSet,
                0,
                length - config.numOfRecsStore - 1
              );
            }
          );
        }
      );
    }
  }

  /**
   * Wilson score predicts the "best rated" score
   * The wilson score is a value between 0 and 1.
   *
   * @param {string} itemId
   */
  async _updateWilsonScore(itemId) {
    const scoreboard = keyBuilder.scoreboardZSet();
    const likedBySet = keyBuilder.itemLikedBySet(itemId);
    const dislikedBySet = keyBuilder.itemDislikedBySet(itemId);
    // used for a confidence interval of 95%
    const z = 1.96;
    let score;
    // getting the liked count for the item
    const likedResults = await this.redisClient.scard(likedBySet);
    // getting the disliked count for the item
    const dislikedResults = await this.redisClient.scard(dislikedBySet);
    // continue only if there are ratings
    const n = likedResults + dislikedResults;
    if (n > 0) {
      // pOS is the amount of total ratings that are positive
      const pOS = likedResults / parseFloat(n);
      try {
        // calculating the wilson score
        // http://www.evanmiller.org/how-not-to-sort-by-average-rating.html
        score =
          (pOS +
            (z * z) / (2 * n) -
            z * Math.sqrt((pOS * (1 - pOS) + (z * z) / (4 * n)) / n)) /
          (1 + (z * z) / n);
      } catch (e) {
        console.log(e.name + ": " + e.message);
        score = 0.0;
      }
      // add that score to the overall scoreboard. if that item already exists, the score will be updated.
      await this.redisClient.zadd(scoreboard, score, itemId);
    }
  }
}

module.exports = BaseRedisHandler;
