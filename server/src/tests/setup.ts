import { beforeAll, afterAll } from "@jest/globals";
import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

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
