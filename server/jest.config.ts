import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "./src",
  testMatch: ["**/tests/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/../tsconfig.json",
      },
    ],
  },
  moduleFileExtensions: ["ts", "js", "json"],
  testTimeout: 30000,
  // Each database-backed suite gets its own Postgres schema per worker (see
  // db.ts and withDatabase.ts), which stops one worker's sync({ force: true })
  // from dropping another's *tables*.
  //
  // Still 1, because the schemas are not as independent as they look. Sequelize
  // hardcodes `public` for ENUM bookkeeping, so a table in jest_worker_3 owns a
  // type in public.enum_*. Every sync({ force: true }) therefore reaches out of
  // its own schema and tries to DROP TYPE public.enum_* - which races against
  // any other worker whose tables still reference that type. It usually wins
  // (parallel runs passed 5 of 5 once the database was clean), and when it
  // loses, the sync fails partway and the run reports a different unrelated
  // file failing with a "socket hang up" or a 404 on a row that was just
  // created. Timing, not safety.
  //
  // Serial keeps exactly one schema live at a time, which makes that race
  // unreachable rather than unlikely. Cost is ~70s of wall clock. Raising this
  // is a real task, not a config flip: the enum types have to live in the same
  // schema as the tables that own them.
  maxWorkers: 1,
};

export default config;
