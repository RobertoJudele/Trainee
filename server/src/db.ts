import { Sequelize } from "sequelize-typescript";
import dotenv from "dotenv";
import { User } from "./models/user";
import { Review } from "./models/review";
import { Trainer } from "./models/trainer";
import { TrainerImage } from "./models/trainerImage";
import { TrainerPackage } from "./models/trainerPackage";
import { TrainerSpecialization } from "./models/trainerSpecialization";
import { Specialization } from "./models/specialization";
import { Gym } from "./models/gym";
import { TrainerGym } from "./models/trainerGym";
import { Issue } from "./models/issue";
import { TrainerWorkingHour } from "./models/trainerWorkingHour";
import { TrainerScheduleSlot } from "./models/trainerScheduleSlot";
import { TrainerBlockedDate } from "./models/trainerBlockedDate";
import { ClientCheckInCode } from "./models/clientCheckInCode";
import { ClientSessionPack } from "./models/clientSessionPack";
import { TrainerInviteCode } from "./models/trainerInviteCode";
import { TrainerClient } from "./models/trainerClient";
import { BillingWebhookEvent } from "./models/billingWebhookEvent";
import { ProfileViewEvent } from "./models/profileViewEvent";
import { BillingTransaction } from "./models/billingTransaction";
import { RefreshToken } from "./models/refreshToken";
import { ClientPreference } from "./models/clientPreference";
import { AppMinVersion } from "./models/appMinVersion";
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
    TrainerPackage,
    TrainerSpecialization,
    Specialization,
    Gym,
    TrainerGym,
    Issue,
    TrainerWorkingHour,
    TrainerScheduleSlot,
    TrainerBlockedDate,
    ClientCheckInCode,
    ClientSessionPack,
    TrainerInviteCode,
    TrainerClient,
    BillingWebhookEvent,
    ProfileViewEvent,
    BillingTransaction,
    RefreshToken,
    ClientPreference,
    AppMinVersion,
  ],
  logging: process.env.NODE_ENV === "test" ? false : (msg) => console.log(`[SEQUELIZE DATABASE] ${msg}`),
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  // AND-merge query-level where clauses with scope where clauses (e.g. Trainer.scope("active"))
  // instead of the default "overwrite" strategy, which lets a query's own top-level Op.and
  // (applyGeoFilters' ST_DWithin radius filter) silently clobber the scope's Op.and and drop
  // the active-subscription filter entirely.
  define: { whereMergeStrategy: "and" },
});

export default sequelize;
