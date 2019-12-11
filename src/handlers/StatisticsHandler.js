const BaseRedisHandler = require("./BaseRedisHandler");
const keyBuilder = require("../helpers/keyBuilder");

class StatisticsHandler extends BaseRedisHandler {
  constructor({ redisClient }) {
    super({ redisClient });
  }

  async recommendFor(userId, numberOfRecs = 10) {
    return await this.redisClient.zrevrangeAsync(
      keyBuilder.recommendedZSet(userId),
      0,
      numberOfRecs
    );
  }

  async bestRated() {
    return await this.redisClient.zrevrangeAsync(
      keyBuilder.scoreboardZSet(),
      0,
      -1
    );
  }

  async worstRated() {
    return await this.redisClient.zrangeAsync(
      keyBuilder.scoreboardZSet(),
      0,
      -1
    );
  }

  async bestRatedWithScores(numOfRatings = 10) {
    return await this.redisClient.zrevrangeAsync(
      keyBuilder.scoreboardZSet(),
      0,
      numOfRatings,
      "withscores"
    );
  }

  async mostLiked() {
    return await this.redisClient.zrevrangeAsync(keyBuilder.mostLiked(), 0, -1);
  }

  async mostDisliked() {
    return await this.redisClient.zrevrangeAsync(
      keyBuilder.mostDisliked(),
      0,
      -1
    );
  }

  async mostSimilarUsers(userId) {
    return await this.redisClient.zrevrangeAsync(
      keyBuilder.similarityZSet(userId),
      0,
      -1
    );
  }

  async leastSimilarUsers(userId) {
    return await this.redisClient.zrangeAsync(
      keyBuilder.similarityZSet(userId),
      0,
      -1
    );
  }

  async likedBy(itemId) {
    return await this.redisClient.smembersAsync(
      keyBuilder.itemLikedBySet(itemId)
    );
  }

  async likedCount(itemId) {
    return await this.redisClient.scardAsync(keyBuilder.itemLikedBySet(itemId));
  }

  async dislikedBy(itemId) {
    return await this.redisClient.smembersAsync(
      keyBuilder.itemDislikedBySet(itemId)
    );
  }

  async dislikedCount(itemId) {
    return await this.redisClient.scardAsync(
      keyBuilder.itemDislikedBySet(itemId)
    );
  }

  async allLikedFor(userId) {
    return await this.redisClient.smembersAsync(
      keyBuilder.userLikedSet(userId)
    );
  }

  async allDislikedFor(userId) {
    return await this.redisClient.smembersAsync(
      keyBuilder.userDislikedSet(userId)
    );
  }

  async allWatchedFor(userId) {
    return await this.redisClient.sunionAsync(
      keyBuilder.userLikedSet(userId),
      keyBuilder.userDislikedSet(userId)
    );
  }
}

module.exports = StatisticsHandler;
