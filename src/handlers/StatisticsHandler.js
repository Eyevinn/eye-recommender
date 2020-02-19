const BaseRedisHandler = require("./BaseRedisHandler");
const keyBuilder = require("../helpers/keyBuilder");

class StatisticsHandler extends BaseRedisHandler {
  constructor({ redisClient }) {
    super({ redisClient });
  }

  /**
   * Get the list of recommendations for named user
   *
   * @param {string} userId
   * @param {number} numberOfRecs
   */
  async recommendationsForUser(userId, numberOfRecs = 10) {
    return await this.redisClient.zrevrange(
      keyBuilder.recommendedZSet(userId),
      0,
      numberOfRecs
    );
  }

  /**
   * Get the items with the best ratings in general
   */
  async bestRated() {
    return await this.redisClient.zrevrange(keyBuilder.scoreboardZSet(), 0, -1);
  }

  /**
   * Get the items with the worst ratings in general
   */
  async worstRated() {
    return await this.redisClient.zrange(keyBuilder.scoreboardZSet(), 0, -1);
  }

  /**
   * Get the items with the best ratings in general
   * includes scores in the result
   *
   * @param {number} numOfRatings
   */
  async bestRatedWithScores(numOfRatings = 10) {
    return await this.redisClient.zrevrange(
      keyBuilder.scoreboardZSet(),
      0,
      numOfRatings,
      "withscores"
    );
  }

  /**
   * Get the most liked assets
   */
  async mostLiked() {
    return await this.redisClient.zrevrange(keyBuilder.mostLiked(), 0, -1);
  }

  /**
   * Get the most disliked assets
   */
  async mostDisliked() {
    return await this.redisClient.zrevrange(keyBuilder.mostDisliked(), 0, -1);
  }

  /**
   * Get the most similar users for a given user
   *
   * @param {string} userId
   */
  async mostSimilarUsers(userId) {
    return await this.redisClient.zrevrange(
      keyBuilder.similarityZSet(userId),
      0,
      -1
    );
  }

  /**
   * Get the least similar users for a given user
   *
   * @param {string} userId
   */
  async leastSimilarUsers(userId) {
    return await this.redisClient.zrange(
      keyBuilder.similarityZSet(userId),
      0,
      -1
    );
  }

  /**
   * Get a list of users who liked a given asset
   * @param {string} itemId
   */
  async likedBy(itemId) {
    return await this.redisClient.smembers(keyBuilder.itemLikedBySet(itemId));
  }

  /**
   * Get the amount of users who liked a given asset
   * @param {string} itemId
   */
  async likedCount(itemId) {
    return await this.redisClient.scard(keyBuilder.itemLikedBySet(itemId));
  }

  /**
   * Get a list of users who disliked a given asset
   * @param {string} itemId
   */
  async dislikedBy(itemId) {
    return await this.redisClient.smembers(
      keyBuilder.itemDislikedBySet(itemId)
    );
  }

  /**
   * Get the amount of users who disliked a given asset
   * @param {string} itemId
   */
  async dislikedCount(itemId) {
    return await this.redisClient.scard(keyBuilder.itemDislikedBySet(itemId));
  }

  /**
   * Get a list of items that the given user has liked
   * @param {string} userId
   */
  async allLikedForUser(userId) {
    return await this.redisClient.smembers(keyBuilder.userLikedSet(userId));
  }

  /**
   * Get a list of items that the given user has disliked
   * @param {string} userId
   */
  async allDislikedForUser(userId) {
    return await this.redisClient.smembers(keyBuilder.userDislikedSet(userId));
  }

  /**
   * Get a list of items that the given user has rated
   * @param {string} userId
   */
  async allWatchedForUser(userId) {
    return await this.redisClient.sunion(
      keyBuilder.userLikedSet(userId),
      keyBuilder.userDislikedSet(userId)
    );
  }
}

module.exports = StatisticsHandler;
