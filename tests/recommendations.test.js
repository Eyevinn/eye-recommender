const redisClient = require("../src/helpers/redisClient");
const eyeRecommender = require("../src/EyeRecommender");

describe("accurate recommendations", () => {
  beforeEach(async () => {
    await redisClient.flushdbAsync();
    await Promise.all([
      eyeRecommender.input.like("ChristianB", "Typical"),
      eyeRecommender.input.like("ChristianB", "Value7"),
      eyeRecommender.input.like("malbery", "Typical"),
      eyeRecommender.input.like("malbery", "Value1"),
      eyeRecommender.input.like("malbery", "Value2"),
      eyeRecommender.input.like("malbery", "Value3"),
      eyeRecommender.input.like("malbery", "Value4"),
      eyeRecommender.input.like("malbery", "Value5"),
      eyeRecommender.input.like("malbery", "Value6"),
      eyeRecommender.input.like("malbery", "Value7")
    ]);
  });
  it("should not have recommendations for malbery", async () => {
    const recommendations = await eyeRecommender.statistics.recommendFor(
      "malbery",
      5
    );
    expect(recommendations[0]).toBeFalsy();
  });
});

describe("recommendations", () => {
  beforeEach(async () => {
    await redisClient.flushdbAsync();
    await Promise.all([
      eyeRecommender.input.like("chris", "batman"),
      eyeRecommender.input.like("chris", "superman"),
      eyeRecommender.input.dislike("chris", "chipmunks"),
      eyeRecommender.input.like("max", "batman"),
      eyeRecommender.input.dislike("max", "chipmunks"),
      eyeRecommender.input.like("greg", "batman"),
      eyeRecommender.input.like("greg", "superman"),
      eyeRecommender.input.like("larry", "batman"),
      eyeRecommender.input.like("larry", "iceage"),
      eyeRecommender.input.dislike("tuhin", "batman"),
      eyeRecommender.input.dislike("tuhin", "superman"),
      eyeRecommender.input.dislike("tuhin", "chipmunks"),
      eyeRecommender.input.dislike("kristina", "batman"),
      eyeRecommender.input.dislike("kristina", "superman"),
      eyeRecommender.input.dislike("andre", "superman"),
      eyeRecommender.input.dislike("andre", "chipmunks"),
      eyeRecommender.input.dislike("guy", "superman")
    ]);
  });

  it("should recommend a movie if a similar user liked it", async () => {
    const recommendations = await eyeRecommender.statistics.recommendFor(
      "andre",
      5
    );
    expect(recommendations[0]).toEqual("batman");
  });

  it("should not recommend a movie that people opposite liked", async () => {
    const recommendations = await eyeRecommender.statistics.recommendFor(
      "andre",
      5
    );
    expect(recommendations.includes("chipmunks")).toBeFalsy();
  });
});
