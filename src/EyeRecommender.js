const redisClient = require("./helpers/redisClient");
const InputHandler = require("./handlers/InputHandler");
const StatisticsHandler = require("./handlers/StatisticsHandler");

class EyeRecommender {
  constructor() {
    console.log("EyeRecommender constructor");
    this.connect();
  }

  connect() {
    this.input = new InputHandler({ redisClient });
    this.statistics = new StatisticsHandler({ redisClient });
  }
};

module.exports = new EyeRecommender();
