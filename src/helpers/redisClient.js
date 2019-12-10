const redis = require("redis");
const promisifyAll = require("util-promisifyall");
const config = require("./config");

promisifyAll(redis.RedisClient.prototype);

const client = redis.createClient(config.redisPort, config.redisUrl);
if (config.redisAuth) {
  client.auth(config.redisAuth, err => {
    if (err) {
      throw err;
    }
  });
}
module.exports = client;
