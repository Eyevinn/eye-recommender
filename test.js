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

let counter = 50;
const go = async () => {
  let randomPerson =
    People[Math.floor(Math.random() * (People.length - 0) + 0)];
  let randomMovie = Movies[Math.floor(Math.random() * (Movies.length - 0) + 0)];
  console.log(`${randomPerson} likes ${randomMovie}`);
  await eyeRecommender.input.like(randomPerson, randomMovie);

  let anotherPersion =
    People[Math.floor(Math.random() * (People.length - 0) + 0)];
  const recommendations = await eyeRecommender.statistics.recommendFor(
    anotherPersion
  );
  console.log(`Recommendations for ${anotherPersion}`, recommendations);

  counter--;
  if (counter > 0) {
    setTimeout(go, 1000);
  }
};

(async () => {
  await eyeRecommender.redisClient.flushdbAsync();
  go();
})();
