import { beforeAll, afterAll } from "@jest/globals";
import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

// The auth limiter allows 25 requests per 15 minutes per IP from an in-memory
// store, and every request in a suite comes from the same IP. Without this a
// suite that exercises signup/login more than 25 times starts asserting against
// 429s instead of the behaviour under test.
process.env.RATE_LIMIT_AUTH_MAX = process.env.RATE_LIMIT_AUTH_MAX ?? "100000";

import "reflect-metadata";
import sequelize from "../db";
import {
  ensureDatabaseExtensions,
  ensureSpatialAndSearchInfrastructure,
} from "../services/databaseBootstrap";
import { seedSpecializations } from "../seeds/specializationSeed";

beforeAll(async () => {
  await sequelize.authenticate();
  await ensureDatabaseExtensions();
  await sequelize.sync({ force: true });
  try {
    await ensureSpatialAndSearchInfrastructure();
  } catch {
    // Spatial search infra may not be needed for basic tests
  }
  await seedSpecializations();
}, 60000);

afterAll(async () => {
  await sequelize.close();
});
