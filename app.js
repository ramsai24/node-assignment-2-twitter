const express = require("express");
const app = express();
app.use(express.json());

const { open } = require("sqlite");

const sqlite3 = require("sqlite3");

const path = require("path");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB error:${e.message}`);
  }
};

initializeDBAndServer();

//API 1 - REGISTER

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;

  console.log(username, password, name, gender);

  // scenario 2

  if (password.length < 6) {
    response.status(400);
    response.send("Password is too short");
  } else {
    const userAvailbilityQuery = `
          SELECT * FROM user WHERE username = '${username}';`;

    console.log(userAvailbilityQuery);

    const dbUser = await db.get(userAvailbilityQuery);

    console.log(dbUser);

    // scenario 3

    if (dbUser === undefined) {
      const hashPassword = await bcrypt.hash(password, 10);
      console.log(hashPassword);
      const createUser = `
        INSERT INTO user (name, username, password, gender)
        VALUES ('${name}', '${username}', '${hashPassword}', '${gender}');`;

      await db.run(createUser);
      response.send("User created successfully");
    }

    // scenario 1
    else {
      response.status(400);
      response.send("User already exists");
    }
  }
});

//API 2

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const payload = {
    username: username,
  };

  const jwtToken = await jwt.sign(payload, "ram");

  const validUser = `SELECT * FROM user WHERE username = '${username}';`;

  const dbUser = await db.get(validUser);

  // scenario 1

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const verifyPass = await bcrypt.compare(password, dbUser.password);

    // scenario 3

    if (verifyPass === true) {
      response.send({ jwtToken });
    }

    // scenario 2
    else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Authentication tokens

const authenticateToken = async (request, response, next) => {
  let jwtToken;

  const authenticate = request.headers["authorization"];

  if (authenticate !== undefined) {
    jwtToken = authenticate.split(" ")[1];
    console.log(jwtToken);
  }
  if (jwtToken !== undefined) {
    const tokenVerify = await jwt.verify(jwtToken, "ram", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();

        //response.send(payload);
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

// //token Authentication

// const authenticateToken = async (request, response, next) => {
//   const { username } = request.body;
//   let jwtToken;
//   const authToken = request.headers;

//   if (authToken === undefined) {
//     response.status(401);
//     response.send("Invalid JWT Token headers");
//   } else {
//     jwtToken = authToken["authorization"].split(" ")[1];
//     console.log(jwtToken);
//   }
//   // console.log(jwtToken);

//   if (jwtToken !== undefined) {
//     const tokenVerify = await jwt.verify(
//       jwtToken,
//       "ram",
//       async (error, payload) => {
//         if (error) {
//           response.status(401);
//           response.send("Invalid JWT Token");
//         } else {
//           request.username = payload.username;
//           next();
//         }
//       }
//     );
//   } else {
//     response.status(401);
//     response.send("Invalid No JWT Token");
//   }
// };

//API 3

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  console.log("ready for Handler function");

  const username = request.username;

  const dbUserQuery = `
  SELECT user_id FROM user WHERE username = '${username}';`;

  const dbUser = await db.get(dbUserQuery);

  console.log(dbUser);

  const sqlQuery = `
  SELECT DISTINCT(user.username) AS username, tweet.tweet, tweet.date_time AS dateTime 
  FROM user  INNER JOIN follower  ON user.user_id = follower.following_user_id
  INNER JOIN tweet  ON  follower.following_user_id  = tweet.user_id
  WHERE follower.follower_user_id = ${dbUser.user_id}
  ORDER BY tweet.date_time desc
  
  LIMIT 4; `;

  const tweetsList = await db.all(sqlQuery);

  response.send(tweetsList);
});

//API 4

app.get("/user/following/", authenticateToken, async (request, response) => {
  console.log("ready for Handler function");

  const username = request.username;

  const dbUserQuery = `
  SELECT user_id FROM user WHERE username = '${username}';`;

  const dbUser = await db.get(dbUserQuery);

  console.log(dbUser);

  const sqlQuery = `
  SELECT (user.name) AS name
  FROM user INNER JOIN follower ON follower.following_user_id = user.user_id
  
  WHERE follower.follower_user_id = ${dbUser.user_id}
  ORDER BY follower.following_user_id; `;
  //   ,user.user_id

  const tweetsList = await db.all(sqlQuery);

  response.send(tweetsList);
});

//API 5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  console.log("ready for Handler function");

  const username = request.username;

  const dbUserQuery = `
  SELECT user_id FROM user WHERE username = '${username}';`;

  const dbUser = await db.get(dbUserQuery);

  console.log(dbUser);

  const sqlQuery = `
  SELECT DISTINCT(user.name) AS name
  FROM user INNER JOIN follower ON follower.follower_user_id = user.user_id
  
  WHERE follower.following_user_id = ${dbUser.user_id}; `;

  const tweetsList = await db.all(sqlQuery);

  response.send(tweetsList);
});

//API 6

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  console.log("ready for Handler function");

  console.log(request.username);

  const username = request.username;

  const dbUserQuery = `
  SELECT user_id FROM user WHERE username = '${username}';`;

  const dbUser = await db.get(dbUserQuery);

  console.log(dbUser);

  const { tweetId } = request.params;

  const sqlQuery = `
  SELECT distinct tweet.tweet as tweet,
  (select count(reply) from reply where reply.tweet_id=${tweetId}) as likes,
  (select count(like_id) from like where like.tweet_id=${tweetId}) as replies,
  date_time as dateTime
  
  FROM reply INNER JOIN tweet ON tweet.tweet_id = reply.tweet_id 
  INNER JOIN like ON tweet.tweet_id = like.tweet_id 
  INNER JOIN follower ON follower.following_user_id= tweet.user_id

  WHERE tweet.tweet_id = ${tweetId} AND follower.follower_user_id = ${dbUser.user_id}
  ORDER BY tweet.tweet_id ;`;

  const tweetsList = await db.get(sqlQuery);

  //COUNT(like.like_id) AS likes, COUNT(reply.reply_id) AS replies  like.like_id, reply.reply_id

  if (tweetsList !== undefined) {
    response.send(tweetsList);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//API 7

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    console.log("ready for Handler function");

    console.log(request.username);

    const username = request.username;

    const dbUserQuery = `
  SELECT user_id FROM user WHERE username = '${username}';`;

    const dbUser = await db.get(dbUserQuery);

    console.log(dbUser);

    const { tweetId } = request.params;

    const sqlQuery = `
  SELECT user.username 
  FROM user INNER JOIN like ON user.user_id = like.user_id 
  INNER JOIN follower ON follower.following_user_id= tweet.user_id
  INNER JOIN tweet ON tweet.tweet_id= like.tweet_id

  WHERE like.tweet_id = ${tweetId} AND follower.follower_user_id = ${dbUser.user_id}
   ORDER BY tweet.tweet_id;`;

    const likesList = await db.all(sqlQuery);
    console.log(likesList);

    let listOfNames = [];

    const namesList = likesList.map((each) => {
      listOfNames.push(each.username);
    });

    console.log(listOfNames);

    //AND follower.follower_user_id = ${dbUser.user_id}    COUNT(like.like_id) AS likes, COUNT(reply.reply_id) AS replies  like.like_id, reply.reply_id

    if (listOfNames.length !== 0) {
      response.send({ likes: listOfNames });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API 8

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    console.log("ready for Handler function");

    console.log(request.username);

    const username = request.username;

    const dbUserQuery = `
  SELECT user_id FROM user WHERE username = '${username}';`;

    const dbUser = await db.get(dbUserQuery);

    console.log(dbUser);

    const { tweetId } = request.params;
    // (select name from reply INNER JOIN user on
    // user.user_id = reply.user_id where reply.tweet_id=${tweetId})

    const sqlQuery = `
  SELECT user.name as name, reply 
  FROM reply INNER JOIN tweet ON tweet.tweet_id = reply.tweet_id 
  INNER JOIN user ON reply.user_id = user.user_id 
  INNER JOIN follower ON follower.following_user_id= tweet.user_id

  WHERE tweet.tweet_id = ${tweetId} AND follower.follower_user_id = ${dbUser.user_id};`;

    const tweetsList = await db.all(sqlQuery);

    //COUNT(like.like_id) AS likes, COUNT(reply.reply_id) AS replies  like.like_id, reply.reply_id

    if (tweetsList.length !== 0) {
      response.send({ replies: tweetsList });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API 9

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  console.log("ready for Handler function");

  console.log(request.username);

  const username = request.username;

  const dbUserQuery = `
  SELECT user_id FROM user WHERE username = '${username}';`;

  const dbUser = await db.get(dbUserQuery);

  console.log(dbUser);

  const sqlQuery = `
  SELECT distinct tweet.tweet as tweet,
  (select  count(distinct like_id) from follower INNER JOIN  like ON follower.following_user_id = like.user_id where like.tweet_id=tweet.tweet_id) as likes,
  (select  count(distinct reply) from follower INNER JOIN  reply ON follower.following_user_id = reply.user_id where reply.tweet_id=tweet.tweet_id) as replies,


  date_time as dateTime
  
  FROM user INNER JOIN tweet ON tweet.user_id = user.user_id 
 

  WHERE user.user_id = ${dbUser.user_id}
  ORDER BY tweet.tweet_id ;`;

  const tweetsList = await db.all(sqlQuery);
  response.send(tweetsList);

  //, COUNT(like_id) AS likes, COUNT(reply_id) AS replies, tweet.date_time AS dateTime
});

//API10
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  console.log(tweet);

  const username = request.username;

  const dbUserQuery = `
  SELECT user_id FROM user WHERE username = '${username}';`;

  const dbUser = await db.get(dbUserQuery);

  console.log(dbUser);

  const postQuery = `
        INSERT INTO tweet (tweet,user_id)
        VALUES ('${tweet}' , ${dbUser.user_id} );`;

  await db.run(postQuery);
  response.send("Created a Tweet");
});

//API 11

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    console.log("ready for Handler function");

    console.log(request.username);

    const username = request.username;

    const dbUserQuery = `
  SELECT user_id FROM user WHERE username = '${username}';`;

    const dbUser = await db.get(dbUserQuery);

    console.log(dbUser);

    const { tweetId } = request.params;

    console.log(tweetId);

    const tweetIdsQuery = `SELECT tweet_id FROM tweet
                            WHERE user_id = ${dbUser.user_id} ;`;

    const tweetsIDs = await db.all(tweetIdsQuery);

    const tweetsIDsList = [];

    tweetsIDs.map((each) => tweetsIDsList.push(each.tweet_id.toString()));

    console.log(tweetsIDsList);

    console.log(tweetsIDsList.includes(tweetId));

    //COUNT(like.like_id) AS likes, COUNT(reply.reply_id) AS replies  like.like_id, reply.reply_id

    if (tweetsIDsList.includes(tweetId)) {
      const deleteQuery = `
        DELETE FROM tweet 
        WHERE tweet_id = ${tweetId};`;

      await db.run(deleteQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
