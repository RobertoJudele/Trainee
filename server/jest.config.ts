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
  // db.ts, DB_TEST_SCHEMA), which is what makes parallelism *possible* here -
  // it is no longer possible for one worker's sync({ force: true }) to drop
  // another's tables.
  //
  // Still pinned to 1, because "possible" turned out not to be "correct". With
  // Jest's default (cores - 1 = 7 on an 8-core machine) roughly 2 runs in 5
  // failed; at 4 workers, about 1 in 7. The failure moves between files each
  // run and takes two shapes: a supertest "socket hang up", and a request that
  // 404s on a row a previous request in the same test just created. Every file
  // passes 6/6 on its own, and serially the suite is stable.
  //
  // Measured and ruled out: schema collisions between workers (instrumented the
  // schema/pid/file timeline across runs - zero overlaps), the server binding a
  // port under test (guarded by NODE_ENV in index.ts), Postgres connection
  // exhaustion (~35 of max_connections=100), and testTimeout (the captured
  // failure was an assertion, not a timeout). So the cause is still unknown,
  // and a suite that lies to you one run in seven is worse than a slow one:
  // serial costs ~90s extra, and a chased phantom costs an afternoon.
  //
  // Raising this is its own task - reproduce the 404 under load first.
  maxWorkers: 1,
};

export default config;
