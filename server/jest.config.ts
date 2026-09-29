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
  // Each worker gets its own Postgres schema (see db.ts, DB_TEST_SCHEMA), so
  // parallel workers no longer drop each other's tables mid-run - this used
  // to be pinned to 1 for exactly that reason. Left unset: Jest's own default
  // (CPU count - 1) is a reasonable starting point for a local machine.
};

export default config;
