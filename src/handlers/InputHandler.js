const BaseRedisHandler = require("./BaseRedisHandler");

class InputHandler extends BaseRedisHandler {
  constructor({ redisClient }) {
    super({ redisClient });
  }

  like(userId, itemId) {
    return super.changeRating({ userId, itemId, liked: true });
  }

  dislike(userId, itemId) {
    return super.changeRating({ userId, itemId, liked: false });
  }

  unlike(userId, itemId) {
    return super.changeRating({ userId, itemId, liked: true, removeRating: true });
  }

  undislike(userId, itemId) {
    return super.changeRating({ userId, itemId, liked: false, removeRating: true });
  }


}

module.exports = InputHandler;
