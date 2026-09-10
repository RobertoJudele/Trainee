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
  // Every suite runs sync({ force: true }) against the same database, so parallel
  // workers drop each other's tables mid-run. Serial until the suites get their
  // own schemas.
  maxWorkers: 1,
};

export default config;
