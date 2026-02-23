import { Sequelize } from "sequelize-typescript";
import dotenv from "dotenv";
import { User } from "./models/user";
import { Review } from "./models/review";
import path from "path";
import { Trainer } from "./models/trainer";
import { TrainerImage } from "./models/trainerImage";
import { TrainerSpecialization } from "./models/trainerSpecialization";
import { Specialization } from "./models/specialization";

dotenv.config();

// DEBUG: Log environment variables
console.log('[DEBUG] DB Connection Variables:');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_PASS:', process.env.DB_PASS ? '***' : 'NOT SET');

const sequelize = new Sequelize({
  database: process.env.DB_NAME || "trainee",
  username: process.env.DB_USER || "admin",
  password: process.env.DB_PASS || "",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  dialect: "postgres",
  models: [
    User,
    Review,
    Trainer,
    TrainerImage,
    TrainerSpecialization,
    Specialization,
  ],
  logging: (msg) => console.log(`[SEQUELIZE DATABASE] ${msg}`),
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export default sequelize;
