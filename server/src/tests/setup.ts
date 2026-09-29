import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

// Jest sets NODE_ENV=test itself before any setup file runs, and dotenv never
// overrides an already-set var - so this holds regardless of what's in
// .env/.env.test, and is the one thing every safety check below depends on.
if (process.env.NODE_ENV !== "test") {
  throw new Error(
    "tests/setup.ts ran outside NODE_ENV=test - refusing to configure a test schema."
  );
}

// Every database-backed suite (see withDatabase.ts) runs inside its own
// Postgres schema instead of `public` - see the comment in ../db.ts for why
// that, not matching DB_NAME against .env, is what actually makes
// sync({force:true}) safe to run against a shared database. One schema per
// Jest worker: files within a worker share it (and re-sync sequentially,
// same as before this change); different workers never collide, which is
// what lets jest.config.ts run them in parallel.
const workerId = process.env.JEST_WORKER_ID || "1";
const testSchema = `jest_worker_${workerId}`;
if (testSchema === "public") {
  // Structurally unreachable given the template above, but this is the one
  // value that would silently defeat the isolation if it ever were reached.
  throw new Error("Refusing to run tests against the public schema.");
}
process.env.DB_TEST_SCHEMA = testSchema;

// Every limiter is raised, not just the auth one.
//
// They all key on IP from an in-memory store, and every request in the suite
// comes from the same IP, so any file that makes more calls than a limiter
// allows starts asserting against 429s instead of against the behaviour under
// test. Only the auth limiter was raised here before, which left `public` at
// its default of 120 requests per 60 seconds - and the busier files
// (trainerSchedule, scheduleService, gymStaff) each make more calls than that.
//
// Whether a file crossed the line inside the window depended on how fast the
// machine was that run, which is why this surfaced as a suite-level ghost: a
// different file failing on each run, never reproducible on its own, and worse
// under parallelism purely because everything takes longer. Raising all of them
// removes the whole class.
process.env.RATE_LIMIT_PUBLIC_MAX = process.env.RATE_LIMIT_PUBLIC_MAX ?? "100000";
process.env.RATE_LIMIT_AUTH_MAX = process.env.RATE_LIMIT_AUTH_MAX ?? "100000";
process.env.RATE_LIMIT_EMAIL_MAX = process.env.RATE_LIMIT_EMAIL_MAX ?? "100000";
process.env.RATE_LIMIT_CHECKOUT_MAX = process.env.RATE_LIMIT_CHECKOUT_MAX ?? "100000";
process.env.RATE_LIMIT_WEBHOOK_MAX = process.env.RATE_LIMIT_WEBHOOK_MAX ?? "100000";

// Nothing else belongs here. A suite that needs a real database imports
// "./withDatabase" itself - see that file for why this used to be global and
// no longer is.
