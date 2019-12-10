const redisClient = require("../src/helpers/redisClient");
const eyeRecommender = require("../src/EyeRecommender");

describe("basic likes, dislikes, unlikes, and undislikes", () => {
  beforeEach(async () => {
    await redisClient.flushdbAsync();
    await Promise.all([
      eyeRecommender.input.like("chris", "batman"),
      eyeRecommender.input.like("larry", "batman"),
      eyeRecommender.input.dislike("greg", "batman"),
      eyeRecommender.input.like("mai", "superman"),
      eyeRecommender.input.unlike("mai", "superman"),
      eyeRecommender.input.dislike("jesse", "superman"),
      eyeRecommender.input.undislike("jesse", "superman")
    ]);
  });
  describe("basic like", () => {
    it("should validate a user has been added after a rating", async () => {
      const result = await redisClient.smembersAsync("movie:user:chris:liked");
      expect(result[0]).toEqual("batman");
    });
  });
  describe("basic dislike", () => {
    it("should validate a user has been added after a rating", async () => {
      const result = await redisClient.smembersAsync(
        "movie:user:greg:disliked"
      );
      expect(result[0]).toEqual("batman");
    });
  });
  describe("basic unlike", function() {
    it("should validate a user has been removed after an unlike", async () => {
      const result = await redisClient.smembersAsync("movie:user:mai:liked");
      expect(result[0]).toBeFalsy();
    });
  });
  describe("basic undislike", function() {
    it("should validate a user has been removed after an undislike", async () => {
      const result = await redisClient.smembersAsync(
        "movie:user:jesse:disliked"
      );
      expect(result[0]).toBeFalsy();
    });
  });
});
