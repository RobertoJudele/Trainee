# Server API Tests Phase 2 — Design Spec

## Overview

Add integration tests for the server's remaining DB-only API routes using the Jest + Supertest infrastructure from Phase 1. Covers 7 route groups (~72 tests): gym, review, issue, specialization, trainerSpecialization, trainerSchedule, recommendation. External-service-dependent routes (billing, trainerImages, email) are deferred to Phase 3.

## Approach

Same as Phase 1: Supertest against the Express `app` with a real PostgreSQL test database (`trainee_test`). No mocking. Each test file creates its own data using shared helpers, and `sync({ force: true })` wipes the DB on each run.

## Infrastructure Changes

### New helpers in `server/src/tests/helpers.ts`

```typescript
createTestAdmin(overrides?)  → { user, token }
// Creates user with role "admin", returns user + JWT

createTestGym(overrides?)    → { gym }
// Inserts a Gym row with sensible defaults (name, address, city, coordinates)
```

No changes to `setup.ts` or `jest.config.ts`.

## Test Files

```
server/src/tests/
├── (existing: auth, user, trainer, trainerPackages)
├── gym.test.ts                  ~10 tests
├── review.test.ts               ~9 tests
├── issue.test.ts                ~8 tests
├── specialization.test.ts       ~4 tests
├── trainerSpecialization.test.ts ~5 tests
├── trainerSchedule.test.ts      ~30 tests
└── recommendation.test.ts       ~6 tests
```

## Test Coverage

### gym.test.ts (~10 tests)

| Endpoint | Test Cases |
|----------|------------|
| `GET /gyms` | Returns gym list; filters by geo query params |
| `GET /gyms/:gymId` | Returns gym details with trainers; 404 for nonexistent |
| `POST /gyms` | Admin creates gym; rejects non-admin; rejects invalid data |
| `POST /gyms/:gymId/join` | Trainer joins gym; rejects non-trainer/client |
| `PATCH /gyms/:gymId/availability` | Toggles trainer availability at gym |
| `DELETE /gyms/:gymId/leave` | Trainer leaves gym |

**Data setup:** `createTestGym` for gym rows, `createTestTrainer` for join/leave, `createTestAdmin` for creation.

### review.test.ts (~9 tests)

| Endpoint | Test Cases |
|----------|------------|
| `GET /reviews/:trainerId` | Returns reviews for trainer; empty array if none |
| `POST /reviews/:trainerId` | Creates review; rejects self-review; rejects duplicate review; rejects without auth |
| `PUT /reviews/:reviewId` | Updates own review; rejects update from non-owner |
| `DELETE /reviews/:reviewId` | Deletes own review; rejects delete from non-owner |

**Data setup:** `createTestTrainer` for the reviewed trainer, `createTestUser` for the reviewer. Self-review test uses the trainer's own token.

### issue.test.ts (~8 tests)

| Endpoint | Test Cases |
|----------|------------|
| `POST /issues` | Creates issue; rejects invalid data; rejects without auth |
| `GET /issues/me` | Returns own issues; empty if none |
| `GET /issues` | Admin lists all issues with filtering; rejects non-admin |
| `PATCH /issues/:issueId/status` | Admin updates issue status + resolution note; rejects non-admin |

**Data setup:** `createTestUser` for reporter, `createTestAdmin` for admin endpoints, `createTestTrainer` for target.

### specialization.test.ts (~4 tests)

| Endpoint | Test Cases |
|----------|------------|
| `GET /specialization` | Returns seeded specializations (public, no auth needed) |
| `POST /specialization` | Admin creates new specialization; rejects non-admin |

**Data setup:** Specializations already seeded by `setup.ts`. `createTestAdmin` for POST.

### trainerSpecialization.test.ts (~5 tests)

| Endpoint | Test Cases |
|----------|------------|
| `POST /trainer-specializations` | Adds specializations to trainer; rejects duplicates; rejects without auth |
| `GET /trainer-specializations` | Returns trainer's linked specializations |

**Data setup:** `createTestTrainer`, seeded specializations from `setup.ts`.

### trainerSchedule.test.ts (~30 tests)

The largest test file, organized by workflow sub-groups:

**Working hours (4 tests):**

| Endpoint | Test Cases |
|----------|------------|
| `POST /trainer-schedule/working-hours` | Create template; update existing template |
| `GET /trainer-schedule/working-hours` | Returns templates; empty if none set |

**Slot generation & CRUD (6 tests):**

| Endpoint | Test Cases |
|----------|------------|
| `POST /trainer-schedule/generate-slots` | Generates slots from templates; rejects >62 day range |
| `GET /trainer-schedule/slots` | Returns slots for date range |
| `POST /trainer-schedule/slots` | Creates one-off slot outside templates |
| `DELETE /trainer-schedule/slots/:slotId` | Deletes available slot; rejects deleting assigned slot |

**Blocked dates (4 tests):**

| Endpoint | Test Cases |
|----------|------------|
| `POST /trainer-schedule/blocked-dates` | Blocks a date |
| `GET /trainer-schedule/blocked-dates` | Returns blocked dates |
| `DELETE /trainer-schedule/blocked-dates/:date` | Unblocks a date |

**Day regeneration (2 tests):**

| Endpoint | Test Cases |
|----------|------------|
| `POST /trainer-schedule/days/:date/regenerate` | Regenerates slots for a day; preserves assigned/completed slots |

**Client assignment (4 tests):**

| Endpoint | Test Cases |
|----------|------------|
| `POST .../slots/:slotId/assign-client` | Assigns client to slot; rejects duplicate day assignment; rejects non-trainer |
| `POST .../slots/:slotId/unassign-client` | Trainer unassigns client; client unassigns own slot |

**Check-in code lifecycle (7 tests):**

| Endpoint | Test Cases |
|----------|------------|
| `POST .../my-schedule/generate-check-in-code` | Client generates 6-digit code |
| `GET .../client-codes/pending` | Returns unexpired pending codes |
| `POST .../client-codes/resolve` | Resolves valid code; rejects invalid code |
| `POST .../slots/:slotId/assign-by-code` | Assigns slot via 6-digit code; consumes code |
| `POST .../slots/:slotId/assign-by-code-id` | Assigns slot via code ID |
| `POST .../slots/:slotId/check-in` | Trainer confirms client check-in |

**Client schedule & search (3 tests):**

| Endpoint | Test Cases |
|----------|------------|
| `GET .../my-schedule` | Returns client's assigned/completed sessions |
| `GET .../clients/search` | Searches clients by name/email; respects min 2-char query |

**Data setup chain:** Create trainer → set working hours → generate slots → create client → assign client. Each `describe` block builds on the previous state or creates its own fresh data.

### recommendation.test.ts (~6 tests)

| Endpoint | Test Cases |
|----------|------------|
| `PUT /recommendations/preferences` | Creates preferences; updates existing preferences |
| `GET /recommendations/preferences` | Returns preferences; returns empty/null if none set |
| `GET /recommendations/trainers` | Returns ranked trainers; respects pagination params |

**Data setup:** `createTestTrainer` with specializations, `createTestGym` for distance scoring, `createTestUser` for client preferences.

## Dependencies

No new npm packages needed. All infrastructure from Phase 1 is reused.

## Out of Scope (Phase 3)

- **billing** — Stripe + RevenueCat dependencies, needs service mocking
- **trainerImages** — S3 upload dependencies, needs service mocking  
- **email** — Email service dependency, needs service mocking
