eyeRecommender
===

Heavily inspired by [recommendationRaccoon](https://github.com/guymorita/recommendationRaccoon/).

A simple similarity based recommendation engine and NPM module built on top of Node.js and Redis.
The engine uses the [Jaccard coefficient](https://en.wikipedia.org/wiki/Jaccard_index) to determine the similarity between users and nearest neighbors to create recommendations.

## Requirements

* Node.js 10.x
* Redis

## Installation

``` bash
npm install eyeRecommender
```

## Quickstart

eyeRecommender keeps track of the ratings and recommendations from your users. It does not need to store any meta data of the user or product aside from an id. To get started:

#### Install eyeRecommender:
``` bash
npm install eyeRecommender
```

#### Setup Redis:

The configuration is defaulted to run against a local Redis instance.
If you want to use a remote instance, you can set the following settings in your environment

- eyeRecommender_REDIS_URL
- eyeRecommender_REDIS_PORT
- eyeRecommender_REDIS_AUTH

#### Example:

```js
const eyeRecommender = require("eyeRecommender");

(async () => {
  await eyeRecommender.input.like("Emilia", "The Holiday");
  await eyeRecommender.input.like("Emilia", "Love Actually");
  await eyeRecommender.input.like("Emilia", "The Grinch");

  await eyeRecommender.input.like("Erik", "The Holiday");
  await eyeRecommender.input.dislike("Erik", "The Grinch");

  const recommendations = await eyeRecommender.statistics.recommendFor("Erik");
  console.log("Recommendations for Erik", recommendations);
})()
```

Outputs
```Recommendations for Erik [ 'Love Actually' ]```

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
await eyeRecommender.statistics.recommendFor("userId", "numberOfRecs (default 10)");
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
await eyeRecommender.statistics.allLikedFor("userId");
// Get a list of items that the given user has disliked
await eyeRecommender.statistics.allDislikedFor("userId");
// Get a list of items that the given user has rated
await eyeRecommender.statistics.allWatchedFor("userId");
```


## Recommendation Engine Components

### Jaccard Coefficient for Similarity

There are many ways to gauge the likeness of two users. The original implementation of recommendation eyeRecommender used the Pearson Coefficient which was good for measuring discrete values in a small range (i.e. 1-5 stars). However, to optimize for quicker calcuations and a simplier interface, recommendation eyeRecommender instead uses the Jaccard Coefficient which is useful for measuring binary rating data (i.e. like/dislike). Many top companies have gone this route such as Youtube because users were primarily rating things 4-5 or 1. The choice to use the Jaccard's instead of Pearson's was largely inspired by David Celis who designed Recommendable, the top recommendation engine on Rails. The Jaccard Coefficient also pairs very well with Redis which is able to union/diff sets of like/dislikes at O(N).

### K-Nearest Neighbors Algorithm for Recommendations

To deal with large user bases, it's essential to make optimizations that don't involve comparing every user against every other user. One way to deal with this is using the K-Nearest Neighbors algorithm which allows you to only compare a user against their 'nearest' neighbors. After a user's similarity is calculated with the Jaccard Coefficient, a sorted set is created which represents how similar that user is to every other. The top users from that list are considered their nearest neighbors. recommendation eyeRecommender uses a default value of 5, but this can easily be changed based on your needs.

### Wilson Score Confidence Interval for a Bernoulli Parameter

If you've ever been to Amazon or another site with tons of reviews, you've probably ran into a sorted page of top ratings only to find some of the top items have only one review. The Wilson Score Interval at 95% calculates the chance that the 'real' fraction of positive ratings is at least x. This allows for you to leave off the items/products that have not been rated enough or have an abnormally high ratio. It's a great proxy for a 'best rated' list.

### Redis

When combined with hiredis, redis can get/set at ~40,000 operations/second using 50 concurrent connections without pipelining. In short, Redis is extremely fast at set math and is a natural fit for a recommendation engine of this scale. Redis is integral to many top companies such as Twitter which uses it for their Timeline (substituted Memcached).


## Tech Stack

eyeRecommender is written fully in Javascript. It utilizes the asyncronous, non-blocking features of Node.js for the core of app. The recommendations and ratings are stored in an intermediate data store called Redis which performs extremely well compared to database systems that write every change to disk before committing the transaction. Redis holds the entire dataset in memory. For the actual handling of the parallel asyncronous functions, eyeRecommender uses the async library for Node.js.

## Links

* Code: 'git clone git://github.com/guymorita/recommendationeyeRecommender.git'
* NPM Module: 'https://npmjs.org/package/eyeRecommender'
* Benchmark / Performance repo: 'https://github.com/guymorita/benchmark_eyeRecommender_movielens'
* Demo / UI App repo: 'https://github.com/guymorita/Mosaic-Films---Recommendation-Engine-Demo'
