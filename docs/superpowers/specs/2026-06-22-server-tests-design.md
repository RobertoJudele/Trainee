# Server API Tests — Design Spec

## Overview

Add integration tests for the server's core API routes using Jest + Supertest against a real PostgreSQL test database (`trainee_test`). Tests run locally via `npm test` before deploying. First pass covers 4 route groups: auth, user, trainer, trainer-packages.

## Approach

Supertest against the Express app with a real test database. Each test file imports the Express `app`, makes real HTTP requests through the full middleware pipeline (validation, auth, controller, DB). No mocking of the database layer.

## Test Infrastructure

### Jest config

`server/jest.config.ts` using `ts-jest` preset. Loads `.env.test` to override `DB_NAME=trainee_test`.

### Environment

`server/.env.test` — identical to `.env` but with:
- `DB_NAME=trainee_test`
- `JWT_SECRET=test-jwt-secret`
- `CHECKIN_CODE_SECRET=test-checkin-secret`
- `NODE_ENV=test`

### App export

Add `export { app }` to `server/src/index.ts` so supertest can import it. The server startup (`startServer()`) remains unchanged — supertest doesn't need `app.listen()`.

### Setup file

`server/src/tests/setup.ts`:
- **beforeAll:** connect to test DB, run `sequelize.sync({ force: true })` to recreate all tables, seed specializations.
- **afterAll:** close the DB connection.
- **beforeEach (optional):** truncate tables between tests for isolation (or use per-describe setup).

### Test helpers

`server/src/tests/helpers.ts`:
- `createTestUser(overrides?)` — inserts a User row, generates a JWT via `generateToken`, returns `{ user, token }`.
- `createTestTrainer(overrides?)` — calls `createTestUser` with role `trainer`, creates a Trainer profile, returns `{ user, trainer, token }`.
- Both helpers use unique emails (e.g., timestamp-based) to avoid collisions.

## Test Structure

```
server/src/tests/
├── setup.ts                  # DB lifecycle
├── helpers.ts                # Auth + data helpers
├── auth.test.ts              # Auth endpoints
├── user.test.ts              # User profile endpoints
├── trainer.test.ts           # Trainer profile + search endpoints
└── trainerPackages.test.ts   # Trainer packages CRUD
```

## Test Coverage

### auth.test.ts

| Endpoint | Test Cases |
|----------|------------|
| `POST /auth/signup` | Valid signup, duplicate email, missing required fields |
| `POST /auth/login` | Valid login, wrong password, nonexistent email |
| `POST /auth/refresh` | Valid refresh, invalid/expired token |
| `POST /auth/forgot-password` | Valid email, nonexistent email (should not leak info) |

### user.test.ts

| Endpoint | Test Cases |
|----------|------------|
| `GET /users/profile` | Authenticated returns profile, unauthenticated returns 401 |
| `PUT /users/profile` | Update fields, validation errors |
| `DELETE /users/profile` | Successful deletion, unauthenticated returns 401 |

### trainer.test.ts

| Endpoint | Test Cases |
|----------|------------|
| `POST /trainer` | Create trainer profile, duplicate prevention |
| `GET /trainer/profile` | Own profile authenticated, unauthenticated 401 |
| `PUT /trainer/profile` | Update fields, validation errors |
| `GET /trainer/search` | No filters, with minRate/maxRate, with specialization filter |
| `GET /trainer/:publicId` | Valid ID returns trainer, invalid returns 404 |

### trainerPackages.test.ts

| Endpoint | Test Cases |
|----------|------------|
| `GET /trainer-packages/:trainerId` | Returns packages for trainer |
| `POST /trainer-packages` | Create package, validation errors, max 5 limit |
| `PUT /trainer-packages/:id` | Update package, ownership enforcement |
| `DELETE /trainer-packages/:id` | Delete package, ownership enforcement, session rate recalculation |

## Dependencies

Already installed: `jest` (v30), `supertest` (v7).

Need to install: `ts-jest`, `@types/jest`, `@types/supertest`.
