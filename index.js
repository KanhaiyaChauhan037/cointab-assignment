const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql");

const app = express();
const port = 3000;

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "kanhaiya",
  database: "nodejs",
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION = 24 * 60 * 60 * 1000;

const blockedUsers = new Map();
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/login.html");
});

app.post("/login", (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  if (blockedUsers.has(email)) {
    const blockTime = blockedUsers.get(email);
    const remainingTime = blockTime - Date.now();
    if (remainingTime > 0) {
      const hours = Math.floor(remainingTime / (60 * 60 * 1000));
      const minutes = Math.floor(
        (remainingTime % (60 * 60 * 1000)) / (60 * 1000)
      );
      const seconds = Math.floor((remainingTime % (60 * 1000)) / 1000);
      res.send(
        `You are blocked for ${hours} hours, ${minutes} minutes, and ${seconds} seconds`
      );
      return;
    } else {
      blockedUsers.delete(email);
    }
  }

  connection.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    (error, results, fields) => {
      if (error) throw error;

      if (results.length === 0) {
           res.send('Please enter email and password!');
        return;
      } 
      const user = results[0];

      if (user.password !== password) {
        if (!user.login_attempts) user.login_attempts = 0;
        user.login_attempts += 1;

        if (user.login_attempts >= MAX_LOGIN_ATTEMPTS) {
          blockedUsers.set(email, Date.now() + BLOCK_DURATION);
          delete user.login_attempts;
          connection.query(
            "UPDATE users SET login_attempts = NULL WHERE email = ?",
            [email],
            (error, results, fields) => {
              if (error) throw error;
            }
          );
          res.send(
            `You have exceeded the maximum number of login attempts. You are blocked for ${
              BLOCK_DURATION / (60 * 60 * 1000)
            } hours.`
          );
        } else {
          connection.query(
            "UPDATE users SET login_attempts = ? WHERE email = ?",
            [user.login_attempts, email],
            (error, results, fields) => {
              if (error) throw error;
            }
          );
          res.send(
            `Invalid password. You have ${
              MAX_LOGIN_ATTEMPTS - user.login_attempts
            } attempts remaining.`
          );
        }
      } else {
        connection.query(
          "UPDATE users SET login_attempts = NULL WHERE email = ?",
          [email],
          (error, results, fields) => {
            if (error) throw error;
          }
        );
        res.redirect("/home");
      }
    }
  );
});

app.get("/home", (req, res) => {
  const email = req.body.email;
  res.send(`Welcome back ${email}! <br><br> <a href="/logout"><button>Logout</button></a>`);
});

// app.get('/home', (req, res) => {
//      const email = req.body.email;
//      if (req.session.loggedin) {
//           res.send(`Welcome back, ${req.session.email}!<br><br><a href="/logout">Logout</a>`);
//      } else {
//           res.send('Please login to view this page!');
//      }
//      res.end();
// });

app.get("/logout", (req, res) => {
  res.clearCookie("email");
  res.redirect("/");
});
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
