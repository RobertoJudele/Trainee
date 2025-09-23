import { Sequelize } from "sequelize-typescript";
import dotenv from "dotenv";
import { User } from "./models/user";

dotenv.config();

const sequelize = new Sequelize({
  database: process.env.DB_NAME || "trainee",
  username: process.env.DB_USER || "admin",
  password: process.env.DB_PASS || "",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  dialect: "postgres",
  models: [User],
  logging: true, // Enable logging to see SQL queries
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export default sequelize;