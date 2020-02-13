const eyeRecommender = require("./src/EyeRecommender");

const People = [
  "Chris",
  "Tim",
  "Gary",
  "Malou",
  "Pater",
  "Erik",
  "John",
  "Emilia",
  "Sophie"
];

const Movies = [
  "The Holiday",
  "Love Actually",
  "The Grinch",
  "Home Alone",
  "Die Hard",
  "Die Hard 2",
  "Die Hard 3"
];

const go = async () => {
  let randomPerson =
    People[Math.floor(Math.random() * (People.length - 0) + 0)];
  let randomMovie = Movies[Math.floor(Math.random() * (Movies.length - 0) + 0)];

  const randomNumber = Math.floor(Math.random() * 100);
  const inputType =
    randomNumber <= 25
      ? "like"
      : randomNumber > 25 && randomNumber <= 50
      ? "dislike"
      : randomNumber > 50 && randomNumber <= 75
      ? "unlike"
      : randomNumber > 75
      ? "undislike"
      : "";
  switch (inputType) {
    case "like":
      console.log(`${randomPerson} likes ${randomMovie}`);
      await eyeRecommender.input.like(randomPerson, randomMovie);
      break;
    case "dislike":
      console.log(`${randomPerson} dislikes ${randomMovie}`);
      await eyeRecommender.input.dislike(randomPerson, randomMovie);
      break;
    case "unlike":
      console.log(`${randomPerson} unlikes ${randomMovie}`);
      await eyeRecommender.input.unlike(randomPerson, randomMovie);
      break;
    case "undislike":
      console.log(`${randomPerson} undislikes ${randomMovie}`);
      await eyeRecommender.input.undislike(randomPerson, randomMovie);
      break;
    default:
      break;
  }

  let anotherPersion =
    People[Math.floor(Math.random() * (People.length - 0) + 0)];
  const recommendations = await eyeRecommender.statistics.recommendationsForUser(
    anotherPersion
  );
  console.log(`Recommendations for ${anotherPersion}`, recommendations);

  setTimeout(go, 1000);
};

const stats = async () => {
  console.log(
    "Best rated",
    await eyeRecommender.statistics.bestRatedWithScores()
  );
  console.log("Most liked", await eyeRecommender.statistics.mostLiked());
  console.log("Most disliked", await eyeRecommender.statistics.mostDisliked());
};

(async () => {
  await eyeRecommender.redisClient.flushdb();
  go();
})();
