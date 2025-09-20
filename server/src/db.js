const { Pool } = require("pg");

const pool = new Pool({
  user: "admin",
  password: "admin",
  host: "localhost",
  port: 5432, // default Postgres port
  database: "trainee",
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
