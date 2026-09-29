// Opt-in database setup for suites that actually need Postgres - a live app
// (import { app } from "../index") or a model. Import this once, near the top
// of the test file, for its side effect:
//
//   import "./withDatabase";
//
// Registering beforeAll/afterAll here, at module-evaluation time, attaches
// them to whichever test file imported this module - standard Jest behaviour
// for hooks executed while a test file's own module graph is being loaded.
//
// This used to run unconditionally for every suite via jest.config.ts's
// setupFilesAfterEnv, which meant suites with no database at all (pure
// functions, or a structural test that only greps source files) still paid
// for authenticate() + sync({force:true}) across every table + the spatial/
// search bootstrap + a seed, every time. Suites that don't import this file
// now skip all of it and never open a connection.
import { beforeAll, afterAll } from "@jest/globals";
import "reflect-metadata";
import sequelize, { testSchemaName } from "../db";
import {
  ensureDatabaseExtensions,
  ensureSpatialAndSearchInfrastructure,
} from "../services/databaseBootstrap";
import { seedSpecializations } from "../seeds/specializationSeed";

beforeAll(async () => {
  await sequelize.authenticate();
  if (testSchemaName) {
    // A fresh Postgres database only has `public`; db.ts's `schema` option
    // makes every later statement target this schema, but does not create
    // it. Idempotent - safe to call again for each file a worker runs.
    await sequelize.createSchema(testSchemaName, {});
  }
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
