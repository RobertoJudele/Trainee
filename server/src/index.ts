import express from "express";
const db = require("./db");
// create a server
const app = express();

// app.get("/", (request, response) => {
//   response.send("<h1>Hello World, How Are You?</h1>");
// });

app.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM users");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

// listen to some port
app.listen(8000, () => {
  console.log("listening");
});
