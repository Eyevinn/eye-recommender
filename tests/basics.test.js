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

// describe('accurate recommendations', function(){
//   before(function(done){
//     client.flushdbAsync().then(() => {
//       return eyeRecommender.liked('ChristianB', 'Typical');
//     }).then(() => {
//       return eyeRecommender.liked('ChristianB', 'Value7');
//     }).then(() => {
//       return eyeRecommender.liked('malbery', 'Typical');
//     }).then(() => {
//       return eyeRecommender.liked('malbery', 'Value1');
//     }).then(() => {
//       return eyeRecommender.liked('malbery', 'Value2');
//     }).then(() => {
//       return eyeRecommender.liked('malbery', 'Value3');
//     }).then(() => {
//       return eyeRecommender.liked('malbery', 'Value4');
//     }).then(() => {
//       return eyeRecommender.liked('malbery', 'Value5');
//     }).then(() => {
//       return eyeRecommender.liked('malbery', 'Value6');
//     }).then(() => {
//       return eyeRecommender.liked('malbery', 'Value7');
//     }).then(() => {
//       done();
//     });
//   });
//   it('should not have recommendations for malbery', function(done){
//     eyeRecommender.recommendFor('malbery', 5).then((recs) => {
//       assert.equal(recs[0], undefined);
//       done();
//     });
//   });
// });

// describe('recommendations', function(){
//   before(function(done){
//     client.flushdbAsync().then(() => {
//       return eyeRecommender.liked('chris', 'batman');
//     }).then(() => {
//       return eyeRecommender.liked('chris', 'superman');
//     }).then(() => {
//       return eyeRecommender.disliked('chris', 'chipmunks');
//     }).then(() => {
//       return eyeRecommender.liked('max', 'batman');
//     }).then(() => {
//       return eyeRecommender.disliked('max', 'chipmunks');
//     }).then(() => {
//       return eyeRecommender.liked('greg', 'batman');
//     }).then(() => {
//       return eyeRecommender.liked('greg', 'superman');
//     }).then(() => {
//       return eyeRecommender.liked('larry', 'batman');
//     }).then(() => {
//       return eyeRecommender.liked('larry', 'iceage');
//     }).then(() => {
//       return eyeRecommender.disliked('tuhin', 'batman');
//     }).then(() => {
//       return eyeRecommender.disliked('tuhin', 'superman');
//     }).then(() => {
//       return eyeRecommender.disliked('tuhin', 'chipmunks');
//     }).then(() => {
//       return eyeRecommender.disliked('kristina', 'batman');
//     }).then(() => {
//       return eyeRecommender.disliked('kristina', 'superman');
//     }).then(() => {
//       return eyeRecommender.disliked('andre', 'superman');
//     }).then(() => {
//       return eyeRecommender.disliked('andre', 'chipmunks');
//     }).then(() => {
//       return eyeRecommender.disliked('guy', 'superman', { updateRecs: false });
//     }).then(() => {
//       done();
//     });
//   });
//   it('should recommend a movie if a similar user liked it', function(done){
//     eyeRecommender.recommendFor('andre', 5).then((recs) => {
//       assert.equal(recs[0], 'batman');
//       done();
//     });
//   });
//   it('should not recommend a movie if updateRecs was false', function(done){
//     eyeRecommender.recommendFor('guy', 5).then((recs) => {
//       assert.equal(recs[0], undefined);
//       done();
//     });
//   });
//   // it('should not recommend a movie that people opposite liked', function(done){
//   //   eyeRecommender.recommendFor('andre', 5, function(recs){
//   //     assert.notEqualequal(recs[0], 'chipmunks');
//   //     done();
//   //   });
//   // });
// });

// describe('stats1', function(){
//   before(function(done){
//     client.flushdbAsync().then(() => {
//       return eyeRecommender.liked('chris', 'batman');
//     }).then(() => {
//       return eyeRecommender.liked('chris', 'superman');
//     }).then(() => {
//       return eyeRecommender.disliked('chris', 'chipmunks');
//     }).then(() => {
//       return eyeRecommender.liked('max', 'batman');
//     }).then(() => {
//       return eyeRecommender.disliked('max', 'chipmunks');
//     }).then(() => {
//       return eyeRecommender.liked('greg', 'batman');
//     }).then(() => {
//       return eyeRecommender.liked('greg', 'superman');
//     }).then(() => {
//       return eyeRecommender.liked('larry', 'batman');
//     }).then(() => {
//       return eyeRecommender.liked('larry', 'iceage');
//     }).then(() => {
//       return eyeRecommender.disliked('tuhin', 'batman');
//     }).then(() => {
//       return eyeRecommender.disliked('tuhin', 'superman');
//     }).then(() => {
//       return eyeRecommender.disliked('tuhin', 'chipmunks');
//     }).then(() => {
//       for (var i = 0; i < 25; i++){
//         eyeRecommender.liked('user'+i, 'batman');
//       }
//       done();
//     });
//   });
//   it('should have batman as the bestRated even though iceage has only likes', function(done){
//     eyeRecommender.bestRated().then((bestRated) => {
//       assert.equal(bestRated[0], 'batman');
//       done();
//     });
//   });
//   it('should have chipmunks as the worst rated', function(done){
//     eyeRecommender.worstRated().then((worstRated) => {
//       assert.equal(worstRated[0], 'chipmunks');
//       done();
//     });
//   });
//   it('should have batman as the most liked and superman as second', function(done){
//     eyeRecommender.mostLiked().then((mostLiked) => {
//       assert.equal(mostLiked[0], 'batman');
//       assert.equal(mostLiked[1], 'superman');
//       done();
//     });
//   });
//   it('should have chipmunks as the most disliked', function(done){
//     eyeRecommender.mostDisliked().then((mostDisliked) => {
//       assert.equal(mostDisliked[0], 'chipmunks');
//       done();
//     });
//   });
//   it('should have an accurate list of users who liked an item', function(done){
//     eyeRecommender.likedBy('superman').then((listOfUsers) => {
//       assert.include(listOfUsers, 'chris');
//       assert.include(listOfUsers, 'greg');
//       done();
//     });
//   });
//   it('should have an accurate number of users who liked an item', function(done){
//     eyeRecommender.likedCount('batman').then((numUsers) => {
//       assert.equal(numUsers, 29);
//       done();
//     });
//   });
//   it('should have an accurate list of users who disliked an item', function(done){
//     eyeRecommender.dislikedBy('chipmunks').then((listOfUsers) => {
//       expect(listOfUsers).to.include('chris');
//       expect(listOfUsers).to.include('max');
//       expect(listOfUsers).to.include('tuhin');
//       done();
//     });
//   });
//   it('should have an accurate number of users who disliked an item', function(done){
//     eyeRecommender.dislikedCount('superman').then((numUsers) => {
//       assert.equal(numUsers, 1);
//       done();
//     });
//   });
//   it('should list all a users likes', function(done){
//     eyeRecommender.allLikedFor('greg').then((itemList) => {
//       expect(itemList).to.include('batman');
//       expect(itemList).to.include('superman');
//       done();
//     });
//   });
//   it('should list all a users dislikes', function(done){
//     eyeRecommender.allDislikedFor('tuhin').then((itemList) => {
//       expect(itemList).to.include('batman');
//       expect(itemList).to.include('superman');
//       expect(itemList).to.include('chipmunks');
//       done();
//     });
//   });
//   it('should list all a users rated items', function(done){
//     eyeRecommender.allWatchedFor('max').then((itemList) => {
//       expect(itemList).to.include('batman');
//       expect(itemList).to.include('chipmunks');
//       done();
//     });
//   });
//   it('should not have similar users before updating', function(done){
//     eyeRecommender.mostSimilarUsers('chris').then((similarUsers) => {
//       assert.equal(similarUsers[0], undefined);
//       done();
//     });
//   });
//   it('should not have dissimilar users before updating', function(done){
//     eyeRecommender.leastSimilarUsers('chris').then((leastSimilarUsers) => {
//       assert.equal(leastSimilarUsers[0], undefined);
//       done();
//     });
//   });
// });

// // describe('db connections', function(){
// //   it('should connect to a remove db successfully', function(done){
// //     client.flushdb();
// //     client.end();
// //     client.quit();
// //     config.localSetup = false;
// //     config.remoteRedisPort = 6379;
// //     config.remoteRedisURL = '127.0.0.1';
// //     config.remoteRedisAuth = 1111;
// //     eyeRecommender.liked('chris', 'batman', function(){
// //       eyeRecommender.allLikedFor('chris', function(itemList){
// //         expect(itemList).to.include('batman');
// //         client.flushdb();
// //         client.end();
// //         config.localSetup = true;
// //         done();
// //       });
// //     });
// //   });
// // });
