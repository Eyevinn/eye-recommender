const config = require("./config");
const Redis = require("ioredis");

const opts = {
  port: config.redisPort,
  host: config.redisUrl,
  passowrd: config.redisAuth
};

const client = new Redis(opts);
module.exports = client;
