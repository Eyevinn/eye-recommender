const eyeRecommender = require("../src/EyeRecommender");

describe("callbacks", () => {
  it("should resolve a promise when like is added", async done => {
    await eyeRecommender.input.like("hao", "superman");
    done();
  });
  it("should resolve a promise when a disliked is added", async done => {
    await eyeRecommender.input.dislike("hao", "superman");
    done();
  });
});
