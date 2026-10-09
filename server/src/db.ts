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
import { UserPushToken } from "./models/userPushToken";
import { SlotReminder } from "./models/slotReminder";
import { BillingWebhookEvent } from "./models/billingWebhookEvent";
import { ProfileViewEvent } from "./models/profileViewEvent";
import { BillingTransaction } from "./models/billingTransaction";
import { RefreshToken } from "./models/refreshToken";
import { ClientPreference } from "./models/clientPreference";
import { AppMinVersion } from "./models/appMinVersion";
import { AppReleaseNote } from "./models/appReleaseNote";
import { UserBlock } from "./models/userBlock";
import { PosterCode } from "./models/posterCode";
import { PosterScanEvent } from "./models/posterScanEvent";
import { TrainerContactEvent } from "./models/trainerContactEvent";
dotenv.config();

// Test isolation: every database-backed test suite runs inside its own
// Postgres schema, never inside `public`, so a real sync({force:true}) can
// never reach the tables a running app (or another Jest worker) is using -
// regardless of whether DB_NAME happens to match. tests/setup.ts sets
// DB_TEST_SCHEMA once per worker, derived from JEST_WORKER_ID, before this
// module is first imported. Outside a test run this is undefined and none of
// the below applies, so production/dev connect exactly as before, against
// `public`.
//
// Two mechanisms, and both are needed - one alone isn't enough:
//
// - `schema` (below, on the Sequelize instance) is Sequelize's own option
//   for this: "the connection will use the provided schema instead of the
//   default public". It's what makes plain model queries (User.findOne(),
//   sync()'s CREATE/DROP TABLE) target the right schema. Critically, it is
//   also what Sequelize's own Postgres ENUM bookkeeping (the type behind a
//   `status` column) keys off - that bookkeeping hardcodes `public` if this
//   option is unset, regardless of the connection's actual search_path, so a
//   schema built from search_path alone still fights Sequelize over where
//   the enum type lives.
// - `search_path` (the afterConnect hook below) is what makes the ~40 raw
//   `sequelize.query(...)` calls in services/databaseBootstrap.ts - the
//   PostGIS columns, the trigram indexes, the hand-written CREATE TABLE
//   statements - land in the same schema. Those are plain SQL strings; they
//   never go through the query generator that `schema` configures, so
//   without this they'd silently keep landing in `public`.
export const testSchemaName =
  process.env.NODE_ENV === "test" ? process.env.DB_TEST_SCHEMA : undefined;

if (process.env.NODE_ENV === "test" && !testSchemaName) {
  // Every test run goes through tests/setup.ts, which always sets this. Its
  // absence means db.ts was imported outside that setup - e.g. a script run
  // with NODE_ENV=test by hand - where sync({force:true}) would otherwise
  // fall back to the connection's default `public` schema.
  throw new Error(
    "NODE_ENV=test but DB_TEST_SCHEMA is unset - refusing to connect without " +
      "a dedicated test schema. Run tests through jest (tests/setup.ts sets " +
      "this), not by importing db.ts directly."
  );
}

const sequelize = new Sequelize({
  database: process.env.DB_NAME || "trainee",
  username: process.env.DB_USER || "admin",
  password: process.env.DB_PASS || "",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  dialect: "postgres",
  ...(testSchemaName && {
    schema: testSchemaName,
    hooks: {
      afterConnect: async (connection: unknown): Promise<void> => {
        const conn = connection as { query: (sql: string) => Promise<unknown> };
        await conn.query(`SET search_path TO "${testSchemaName}", public;`);
      },
    },
  }),
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
    UserPushToken,
    SlotReminder,
    BillingWebhookEvent,
    ProfileViewEvent,
    BillingTransaction,
    RefreshToken,
    ClientPreference,
    AppMinVersion,
    AppReleaseNote,
    UserBlock,
    PosterCode,
    PosterScanEvent,
    TrainerContactEvent,
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
