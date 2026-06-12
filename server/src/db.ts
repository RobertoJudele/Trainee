import { Sequelize } from "sequelize-typescript";
import dotenv from "dotenv";
import { User } from "./models/user";
import { Review } from "./models/review";
import { Trainer } from "./models/trainer";
import { TrainerImage } from "./models/trainerImage";
import { TrainerSpecialization } from "./models/trainerSpecialization";
import { Specialization } from "./models/specialization";
import { Gym } from "./models/gym";
import { TrainerGym } from "./models/trainerGym";
import { Issue } from "./models/issue";
import { TrainerWorkingHour } from "./models/trainerWorkingHour";
import { TrainerScheduleSlot } from "./models/trainerScheduleSlot";
import { TrainerBlockedDate } from "./models/trainerBlockedDate";
import { ClientCheckInCode } from "./models/clientCheckInCode";
import { BillingWebhookEvent } from "./models/billingWebhookEvent";
import { ProfileViewEvent } from "./models/profileViewEvent";
import { BillingTransaction } from "./models/billingTransaction";
import { RefreshToken } from "./models/refreshToken";
dotenv.config();

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
    Gym,
    TrainerGym,
    Issue,
    TrainerWorkingHour,
    TrainerScheduleSlot,
    TrainerBlockedDate,
    ClientCheckInCode,
    BillingWebhookEvent,
    ProfileViewEvent,
    BillingTransaction,
    RefreshToken,
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
