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

// The auth limiter allows 25 requests per 15 minutes per IP from an in-memory
// store, and every request in a suite comes from the same IP. Without this a
// suite that exercises signup/login more than 25 times starts asserting against
// 429s instead of the behaviour under test.
process.env.RATE_LIMIT_AUTH_MAX = process.env.RATE_LIMIT_AUTH_MAX ?? "100000";

// Nothing else belongs here. A suite that needs a real database imports
// "./withDatabase" itself - see that file for why this used to be global and
// no longer is.
