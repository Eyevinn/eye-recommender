EyeRecommender
===

A simple similarity based recommendation engine and NPM module built on top of Node.js and Redis.
The engine uses the [Jaccard coefficient](https://en.wikipedia.org/wiki/Jaccard_index) to determine the similarity between users and [k-nearest neighbors](https://en.wikipedia.org/wiki/K-nearest_neighbors_algorithm) to create recommendations.

## Requirements

* Node.js 10.x
* Redis

## Installation

``` bash
npm install @eyevinn/eye-recommender
```

## Quickstart

eyeRecommender keeps track of the ratings and recommendations from your users. It does not need to store any meta data of the user or product aside from an id. To get started:

#### Install eyeRecommender:
``` bash
npm install @eyevinn/eye-recommender
```

#### Setup Redis:

The configuration is defaulted to run against a local Redis instance.
If you want to use a remote instance, you can set the following settings in your environment

- EyeRecommender_REDIS_URL
- EyeRecommender_REDIS_PORT
- EyeRecommender_REDIS_AUTH

#### Example:

```js
const eyeRecommender = require("@eyevinn/eye-recommender");

(async () => {
  await eyeRecommender.input.like("Jane", "The Holiday");
  await eyeRecommender.input.like("Jane", "Love Actually");
  await eyeRecommender.input.like("Jane", "The Grinch");

  await eyeRecommender.input.like("Carly", "The Holiday");
  await eyeRecommender.input.dislike("Carly", "The Grinch");

  const recommendations = await eyeRecommender.statistics.recommendationsForUser("Carly");
  console.log("Recommendations for Carly", recommendations);
})()
```

Outputs
```Recommendations for Carly [ 'Love Actually' ]```

## config

``` js
// these are the default values but you can change them
eyeRecommender.config.nearestNeighbors = 5;  // number of neighbors you want to compare a user against
eyeRecommender.config.className = 'movie';  // prefix for your items (used for redis)
eyeRecommender.config.numOfRecsStore = 30;  // number of recommendations to store per user
```

## Full Usage

### Inputs

```js
// to set ratings
await eyeRecommender.input.like("userId", "itemId");
await eyeRecommender.input.dislike("userId", "itemId");
// to remove already set ratings
await eyeRecommender.input.unlike("userId", "itemId");
await eyeRecommender.input.undislike("userId", "itemId");
```

### Recommendations & Statistics

### Recommendations
``` js
await eyeRecommender.statistics.recommendationsForUser("userId", "numberOfRecs (default 10)");
await eyeRecommender.statistics.mostSimilarUsers("userId");
await eyeRecommender.statistics.leastSimilarUsers("userId");
```

### Statistics

``` js
/**
 * Item related
 */
await eyeRecommender.statistics.bestRated();
await eyeRecommender.statistics.worstRated();
await eyeRecommender.statistics.bestRatedWithScores("numberOfRatings (default 10)");
await eyeRecommender.statistics.mostLiked();
await eyeRecommender.statistics.mostDisliked();
// Get a list of users who liked a given asset
await eyeRecommender.statistics.likedBy("itemId");
// Get the amount of users who liked a given asset
await eyeRecommender.statistics.likedCount("itemId");
// Get a list of users who disliked a given asset
await eyeRecommender.statistics.dislikedBy("itemId");
// Get the amount of users who disliked a given asset
await eyeRecommender.statistics.dislikedCount("itemId");

/**
 * User related
 */

// Get a list of items that the given user has liked
await eyeRecommender.statistics.allLikedForUser("userId");
// Get a list of items that the given user has disliked
await eyeRecommender.statistics.allDislikedForUser("userId");
// Get a list of items that the given user has rated
await eyeRecommender.statistics.allWatchedForUser("userId");
```


## Recommendation Engine Components

### Jaccard Coefficient for Similarity

There are many ways to gauge the likeness of two users. The original implementation of recommendation eyeRecommender used the Pearson Coefficient which was good for measuring discrete values in a small range (i.e. 1-5 stars). However, to optimize for quicker calcuations and a simplier interface, recommendation eyeRecommender instead uses the Jaccard Coefficient which is useful for measuring binary rating data (i.e. like/dislike). Many top companies have gone this route such as Youtube because users were primarily rating things 4-5 or 1. The choice to use the Jaccard's instead of Pearson's was largely inspired by David Celis who designed Recommendable, the top recommendation engine on Rails. The Jaccard Coefficient also pairs very well with Redis which is able to union/diff sets of like/dislikes at O(N).

### K-Nearest Neighbors Algorithm for Recommendations

To deal with large user bases, it's essential to make optimizations that don't involve comparing every user against every other user. One way to deal with this is using the K-Nearest Neighbors algorithm which allows you to only compare a user against their 'nearest' neighbors. After a user's similarity is calculated with the Jaccard Coefficient, a sorted set is created which represents how similar that user is to every other. The top users from that list are considered their nearest neighbors. recommendation eyeRecommender uses a default value of 5, but this can easily be changed based on your needs.

### Wilson Score Confidence Interval for a Bernoulli Parameter

If you've ever been to Amazon or another site with tons of reviews, you've probably ran into a sorted page of top ratings only to find some of the top items have only one review. The Wilson Score Interval at 95% calculates the chance that the 'real' fraction of positive ratings is at least x. This allows for you to leave off the items/products that have not been rated enough or have an abnormally high ratio. It's a great proxy for a 'best rated' list.

#### Heavily inspired by [recommendationRaccoon](https://github.com/guymorita/recommendationRaccoon/).

## About Eyevinn Technology

Eyevinn Technology is an independent consultant firm specialized in video and streaming. Independent in a way that we are not commercially tied to any platform or technology vendor.

At Eyevinn, every software developer consultant has a dedicated budget reserved for open source development and contribution to the open source community. This give us room for innovation, team building and personal competence development. And also gives us as a company a way to contribute back to the open source community.

Want to know more about Eyevinn and how it is to work here. Contact us at work@eyevinn.se!
