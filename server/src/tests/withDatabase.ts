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
    // Dropped before it is created, which matters more than it looks.
    //
    // Sequelize's ENUM bookkeeping hardcodes `public` (see the `schema`
    // fallback in its query generator), so a table in jest_worker_3 depends on
    // a type in public.enum_*. A schema left behind by an earlier run - a run
    // with a different worker count, or one that was killed - therefore keeps
    // those public types undroppable, and the next sync({ force: true }) fails
    // partway through. That failure surfaced as intermittent nonsense: a
    // different test file failing on each run with a supertest "socket hang
    // up" or a 404 on a row the previous request had just created. Roughly one
    // run in four, and only ever in the full suite - which is exactly the kind
    // of ghost that gets blamed on parallelism for a week.
    //
    // Dropping first makes each file's slate genuinely clean rather than clean
    // only if the database happened to be. CASCADE because the schema owns its
    // tables and we want them gone with it.
    await sequelize.dropSchema(testSchemaName, {});
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
  // Leave nothing behind. Within a worker, files run sequentially and each
  // one recreates the schema in its own beforeAll, so dropping here is safe -
  // and it means the last file in each worker cleans up after itself. Without
  // this, a run leaves jest_worker_* schemas lying around that break the suite
  // on any older checkout, since those trees sync against `public` and inherit
  // the cross-schema enum dependency described above.
  if (testSchemaName) {
    try {
      await sequelize.dropSchema(testSchemaName, {});
    } catch {
      // Teardown must not turn a passing suite red; the beforeAll above drops
      // the schema again anyway.
    }
  }
  await sequelize.close();
});
