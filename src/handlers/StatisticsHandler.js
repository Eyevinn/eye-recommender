const BaseRedisHandler = require("./BaseRedisHandler");
const keyBuilder = require("../helpers/keyBuilder");

class StatisticsHandler extends BaseRedisHandler {
  constructor({ redisClient }) {
    super({ redisClient });
  }

  recommendFor(userId, numberOfRecs = 10) {
    return new Promise((resolve, reject) => {
      this.redisClient.zrevrangeAsync(keyBuilder.recommendedZSet(userId), 0, numberOfRecs).then((results) => {
        resolve(results);
      });
    });
  }

  bestRated() {
    return new Promise((resolve, reject) => {
      this.redisClient.zrevrangeAsync(keyBuilder.scoreboardZSet(), 0, -1).then((results) => {
        resolve(results);
      });
    });
  }

  worstRated() {
    return new Promise((resolve, reject) => {
      this.redisClient.zrangeAsync(keyBuilder.scoreboardZSet(), 0, -1).then((results) => {
        resolve(results);
      });
    });
  }

  bestRatedWithScores(numOfRatings) {
    return new Promise((resolve, reject) => {
      this.redisClient.zrevrangeAsync(keyBuilder.scoreboardZSet(), 0, numOfRatings, 'withscores').then((results) => {
        resolve(results);
      });
    });
  }

  mostLiked() {
    return new Promise((resolve, reject) => {
      this.redisClient.zrevrangeAsync(keyBuilder.mostLiked(), 0, -1).then((results) => {
        resolve(results);
      });
    });
  }

  mostDisliked() {
    return new Promise((resolve, reject) => {
      this.redisClient.zrevrangeAsync(keyBuilder.mostDisliked(), 0, -1).then((results) => {
        resolve(results);
      });
    });
  }

  usersWhoLikedAlsoLiked(itemId) {
  }

  mostSimilarUsers(userId) {
    return new Promise((resolve, reject) => {
      this.redisClient.zrevrangeAsync(keyBuilder.similarityZSet(userId), 0, -1).then((results) => {
        resolve(results);
      });
    });
  }

  leastSimilarUsers(userId) {
    return new Promise((resolve, reject) => {
      this.redisClient.zrangeAsync(keyBuilder.similarityZSet(userId), 0, -1).then((results) => {
        resolve(results);
      });
    });
  }

  likedBy(itemId) {
    return new Promise((resolve, reject) => {
      this.redisClient.smembersAsync(keyBuilder.itemLikedBySet(itemId)).then((results) => {
        resolve(results);
      });
    });
  }

  likedCount(itemId) {
    return new Promise((resolve, reject) => {
      this.redisClient.scardAsync(keyBuilder.itemLikedBySet(itemId)).then((results) => {
        resolve(results);
      });
    });
  }

  dislikedBy(itemId) {
    return new Promise((resolve, reject) => {
      this.redisClient.smembersAsync(keyBuilder.itemDislikedBySet(itemId)).then((results) => {
        resolve(results);
      });
    });
  }

  dislikedCount(itemId) {
    return new Promise((resolve, reject) => {
      this.redisClient.scardAsync(keyBuilder.itemDislikedBySet(itemId)).then((results) => {
        resolve(results);
      });
    });
  }

  allLikedFor(userId) {
    return new Promise((resolve, reject) => {
      this.redisClient.smembersAsync(keyBuilder.userLikedSet(userId)).then((results) => {
        resolve(results);
      });
    });
  }

  allDislikedFor(userId) {
    return new Promise((resolve, reject) => {
      this.redisClient.smembersAsync(keyBuilder.userDislikedSet(userId)).then((results) => {
        resolve(results);
      });
    });
  }

  allWatchedFor(userId) {
    return new Promise((resolve, reject) => {
      this.redisClient.sunionAsync(keyBuilder.userLikedSet(userId), keyBuilder.userDislikedSet(userId)).then((results) => {
        resolve(results);
      });
    });
  }
}

module.exports = StatisticsHandler;
