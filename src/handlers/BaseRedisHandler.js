const keyBuilder = require("../helpers/keyBuilder");
const config = require("../helpers/config");
const utilities = require("../helpers/utilities");
const async = require("async");

class BaseRedisHandler {
  constructor({ redisClient }) {
    this.redisClient = redisClient;
  }

  async updateSequence(userId, itemId) {
    await this.updateSimilarityFor(userId);
    await Promise.all([
      this.updateWilsonScore(itemId),
      this.updateRecommendationsFor(userId)
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
      ? await this.redisClient.sremAsync(feelingUserSet, itemId)
      : await this.redisClient.saddAsync(feelingUserSet, itemId);

    (await removeRating)
      ? await this.redisClient.sremAsync(feelingItemSet, userId)
      : await this.redisClient.saddAsync(feelingItemSet, userId);

    const done = await this.redisClient.sismemberAsync(feelingItemSet, userId);

    if (updateRecommendations && done) {
      await this.updateSequence(userId, itemId);
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
  async jaccardCoefficient(userId1, userId2) {
    let similarity = 0;
    let finalJaccardScore = 0;
    let ratedInCommon = 0;

    const user1LikedSet = keyBuilder.userLikedSet(userId1);
    const user1DislikedSet = keyBuilder.userDislikedSet(userId1);
    const user2LikedSet = keyBuilder.userLikedSet(userId2);
    const user2DislikedSet = keyBuilder.userDislikedSet(userId2);

    // common likes
    const results1 = await this.redisClient.sinterAsync(
      user1LikedSet,
      user2LikedSet
    );
    // common dislikes
    const results2 = await this.redisClient.sinterAsync(
      user1DislikedSet,
      user2DislikedSet
    );
    // disagreements where user 1 likes things user 2 dislikes
    const results3 = await this.redisClient.sinterAsync(
      user1LikedSet,
      user2DislikedSet
    );
    // disagreements where user 1 dislikes things user 2 likes
    const results4 = await this.redisClient.sinterAsync(
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
    return finalJaccardScore;
  }

  /**
   * Updates the similarities between the user versus all the others.
   * Value between -1 and 1.
   * -1 is exact opposite, 1 is exactly the same.
   *
   * @param {string} userId
   */
  async updateSimilarityFor(userId) {
    userId = String(userId);
    let itemLiked, itemDisliked, itemLikeDislikeKeys;
    const similarityZSet = keyBuilder.similarityZSet(userId);

    // create a set with all likes and dislikes for this user
    const userRatedItemIds = await this.redisClient.sunionAsync(
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
    const otherUserIdsWhoRated = await this.redisClient.sunionAsync(
      itemLikeDislikeKeys
    );
    async.each(otherUserIdsWhoRated, async otherUserId => {
      if (otherUserIdsWhoRated.length === 1 || userId === otherUserId) return;
      if (userId != otherUserId) {
        // get the similarities
        const jaccardScore = await this.jaccardCoefficient(userId, otherUserId);
        // save as a list with similarity scores
        await this.redisClient.zaddAsync(
          similarityZSet,
          jaccardScore,
          otherUserId
        );
      }
    });
  }

  async predictFor(userId, itemId) {
    userId = String(userId);
    itemId = String(itemId);
    let finalSimilaritySum = 0.0;
    let prediction = 0.0;
    const similarityZSet = keyBuilder.similarityZSet(userId);
    const likedBySet = keyBuilder.itemLikedBySet(itemId);
    const dislikedBySet = keyBuilder.itemDislikedBySet(itemId);

    const [result1, result2] = await Promise.all([
      this.similaritySum(similarityZSet, likedBySet),
      this.similaritySum(similarityZSet, dislikedBySet)
    ]);
    finalSimilaritySum = result1 - result2;
    const likedbyCount = await this.redisClient.scardAsync(likedBySet);
    const dislikedByCount = await this.redisClient.scardAsync(dislikedBySet);
    prediction =
      finalSimilaritySum / parseFloat(likedbyCount + dislikedByCount);
    return prediction;
  }

  async similaritySum(simSet, compSet) {
    let similarSum = 0.0;
    const userIds = await this.redisClient.smembersAsync(compSet);
    async.each(userIds, async userId => {
      const zScore = await this.redisClient.zscoreAsync(simSet, userId);
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
  async updateRecommendationsFor(userId) {
    userId = String(userId);
    let setsToUnion = [];
    let scoreMap = [];
    const tempAllLikedSet = keyBuilder.tempAllLikedSet(userId);
    const similarityZSet = keyBuilder.similarityZSet(userId);
    const recommendedZSet = keyBuilder.recommendedZSet(userId);

    const mostSimilarUserIds = await this.redisClient.zrevrangeAsync(
      similarityZSet,
      0,
      config.nearestNeighbors - 1
    );

    const leastSimilarUserIds = await this.redisClient.zrangeAsync(
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
      await this.redisClient.sunionstoreAsync(setsToUnion);
      const notYetRatedItems = await this.redisClient.sdiffAsync(
        tempAllLikedSet,
        keyBuilder.userLikedSet(userId),
        keyBuilder.userDislikedSet(userId)
      );
      // iterate through the items which the user hasn't rated yet
      // and predict what they would think about thos
      async.each(
        notYetRatedItems,
        async itemId => {
          const score = await this.predictFor(userId, itemId);
          scoreMap.push([score, itemId]);
        },
        async () => {
          // add these predictions to that users recommended set
          await this.redisClient.delAsync(recommendedZSet);
          async.each(
            scoreMap,
            async scorePair => {
              await this.redisClient.zaddAsync(
                recommendedZSet,
                scorePair[0],
                scorePair[1]
              );
            },
            async () => {
              await this.redisClient.delAsync(tempAllLikedSet);
              const length = await this.redisClient.zcardAsync(recommendedZSet);
              await this.redisClient.zremrangebyrankAsync(
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
  async updateWilsonScore(itemId) {
    const scoreboard = keyBuilder.scoreboardZSet();
    const likedBySet = keyBuilder.itemLikedBySet(itemId);
    const dislikedBySet = keyBuilder.itemDislikedBySet(itemId);
    // used for a confidence interval of 95%
    const z = 1.96;
    let score;
    // getting the liked count for the item
    const likedResults = await this.redisClient.scardAsync(likedBySet);
    // getting the disliked count for the item
    const dislikedResults = await this.redisClient.scardAsync(dislikedBySet);
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
      await this.redisClient.zaddAsync(scoreboard, score, itemId);
    }
  }
}

module.exports = BaseRedisHandler;
