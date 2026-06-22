# Server API Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add integration tests for the server's core API routes (auth, user, trainer, trainer-packages) using Jest + Supertest against a real PostgreSQL test database.

**Architecture:** Each test file imports the Express `app` and uses `supertest` to make real HTTP requests through the full middleware stack. A shared setup file manages the test DB lifecycle (connect, sync with `force: true`, seed, teardown). Helper functions provide one-liner authenticated user/trainer creation.

**Tech Stack:** Jest 30, ts-jest, Supertest 7, PostgreSQL (trainee_test database)

## Global Constraints

- Tests use CommonJS modules (`module: "CommonJS"` in tsconfig).
- `experimentalDecorators` and `emitDecoratorMetadata` must be enabled (Sequelize decorators).
- The test DB (`trainee_test`) must exist locally before running tests. Tests `sync({ force: true })` on every run.
- `JWT_SECRET` and `CHECKIN_CODE_SECRET` env vars are required — `.env.test` provides them.
- Password validation requires: min 6 chars, at least one uppercase, one lowercase, one digit.
- All API responses follow `{ success: boolean, message: string, data?: T }` shape.

---

### Task 1: Test infrastructure — config, env, setup, helpers, app export

**Files:**
- Install: `ts-jest`, `@types/jest`, `@types/supertest` (devDependencies)
- Create: `server/jest.config.ts`
- Create: `server/.env.test`
- Create: `server/src/tests/setup.ts`
- Create: `server/src/tests/helpers.ts`
- Modify: `server/src/index.ts` (export `app`)
- Modify: `server/package.json:12` (update test script)

**Interfaces:**
- Consumes: `sequelize` from `server/src/db.ts`, `generateToken` from `server/src/utils/jwt.ts`, `User` model, `Trainer` model, `seedSpecializations` from seeds
- Produces: `app` export from `server/src/index.ts`; `createTestUser(overrides?)` returning `{ user, token }`; `createTestTrainer(overrides?)` returning `{ user, trainer, token }`; global test setup/teardown

- [ ] **Step 1: Install test dependencies**

```bash
cd server && npm install --save-dev ts-jest @types/jest @types/supertest
```

- [ ] **Step 2: Create jest.config.ts**

Create `server/jest.config.ts`:

```typescript
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "./src",
  testMatch: ["**/tests/**/*.test.ts"],
  setupFilesAfterSetup: ["<rootDir>/tests/setup.ts"],
  globalSetup: undefined,
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "../tsconfig.json",
      },
    ],
  },
  moduleFileExtensions: ["ts", "js", "json"],
  testTimeout: 30000,
};

export default config;
```

- [ ] **Step 3: Create .env.test**

Create `server/.env.test`:

```
NODE_ENV=test
PORT=8001
DB_NAME=trainee_test
DB_USER=admin
DB_PASS=
DB_HOST=localhost
DB_PORT=5432
JWT_SECRET=test-jwt-secret-for-testing-only
CHECKIN_CODE_SECRET=test-checkin-secret-for-testing-only
BCRYPT_ROUNDS=4
```

Note: `BCRYPT_ROUNDS=4` speeds up tests significantly (default is 12). `DB_USER` and `DB_PASS` should match your local Postgres credentials — update if yours differ.

- [ ] **Step 4: Export app from index.ts**

In `server/src/index.ts`, add at the end of the file (after `startServer();` at line 113):

```typescript
export { app };
```

Also move the `const app = express();` earlier or keep it where it is — it's already at line 21 which is fine. The key addition is the export.

- [ ] **Step 5: Create setup.ts**

Create `server/src/tests/setup.ts`:

```typescript
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
  await sequelize.sync({ force: true });
  try {
    await ensureDatabaseExtensions();
    await ensureSpatialAndSearchInfrastructure();
  } catch {
    // Extensions may not be available in test DB — that's OK for basic tests
  }
  await seedSpecializations();
}, 60000);

afterAll(async () => {
  await sequelize.close();
});
```

- [ ] **Step 6: Create helpers.ts**

Create `server/src/tests/helpers.ts`:

```typescript
import { User } from "../models/user";
import { Trainer } from "../models/trainer";
import { Specialization } from "../models/specialization";
import { generateToken } from "../utils/jwt";
import { UserRole } from "../types/common";
import { subStatus, BillingProvider } from "../types/trainer";

let counter = 0;

function uniqueEmail(): string {
  counter += 1;
  return `testuser${Date.now()}${counter}@test.com`;
}

interface TestUserOverrides {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

interface TestUserResult {
  user: User;
  token: string;
}

export async function createTestUser(
  overrides?: TestUserOverrides
): Promise<TestUserResult> {
  const user = await User.create({
    email: overrides?.email ?? uniqueEmail(),
    password: overrides?.password ?? "Test123!",
    firstName: overrides?.firstName ?? "Test",
    lastName: overrides?.lastName ?? "User",
    role: overrides?.role ?? "client",
  });

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
  });

  return { user, token };
}

interface TestTrainerOverrides extends TestUserOverrides {
  bio?: string;
  experienceYears?: number;
  locationCity?: string;
  locationState?: string;
}

interface TestTrainerResult extends TestUserResult {
  trainer: Trainer;
}

export async function createTestTrainer(
  overrides?: TestTrainerOverrides
): Promise<TestTrainerResult> {
  const { user, token } = await createTestUser({
    ...overrides,
    role: "trainer",
  });

  const trainer = await Trainer.create({
    userId: user.id,
    bio: overrides?.bio ?? "Test trainer bio",
    experienceYears: overrides?.experienceYears ?? 5,
    locationCity: overrides?.locationCity ?? "Bucharest",
    locationState: overrides?.locationState ?? "Bucharest",
    trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    subscriptionStatus: subStatus.TRIAL,
    stripeCustomerId: "",
    stripeSubscriptionId: "",
  });

  return { user, trainer, token };
}
```

- [ ] **Step 7: Update package.json test script**

In `server/package.json`, update the test script (line 12) to load the test env:

Change:
```json
"test": "jest --passWithNoTests",
```

To:
```json
"test": "jest --passWithNoTests --forceExit --detectOpenHandles",
```

The `--forceExit` ensures Jest doesn't hang on open DB connections. `--detectOpenHandles` helps debug if it does.

- [ ] **Step 8: Create the test database**

Run locally:
```bash
psql -U admin -c "CREATE DATABASE trainee_test;" 2>/dev/null || echo "Database may already exist"
```

Or via your preferred Postgres client, create a database named `trainee_test`.

- [ ] **Step 9: Verify the setup works**

Run:
```bash
cd server && npm test
```

Expected: Jest runs, finds no tests, exits with "No tests found" or passes with 0 test suites (because of `--passWithNoTests`).

- [ ] **Step 10: Commit**

```bash
git add server/jest.config.ts server/.env.test server/src/tests/setup.ts server/src/tests/helpers.ts server/src/index.ts server/package.json
git commit -m "test: add Jest + Supertest infrastructure for server API tests"
```

---

### Task 2: Auth endpoint tests

**Files:**
- Create: `server/src/tests/auth.test.ts`

**Interfaces:**
- Consumes: `app` from `server/src/index.ts`, `createTestUser` from `server/src/tests/helpers.ts`
- Produces: auth test suite covering signup, login, refresh, forgot-password

- [ ] **Step 1: Create auth.test.ts**

Create `server/src/tests/auth.test.ts`:

```typescript
import request from "supertest";
import { app } from "../index";
import { createTestUser } from "./helpers";
import { User } from "../models/user";

describe("Auth API", () => {
  describe("POST /auth/register", () => {
    it("should register a new user", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          email: `signup${Date.now()}@test.com`,
          password: "Test123!",
          firstName: "John",
          lastName: "Doe",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toHaveProperty("id");
      expect(res.body.data.user).toHaveProperty("email");
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.password).toBeUndefined();
    });

    it("should reject duplicate email", async () => {
      const email = `dup${Date.now()}@test.com`;
      await request(app)
        .post("/auth/register")
        .send({
          email,
          password: "Test123!",
          firstName: "John",
          lastName: "Doe",
        });

      const res = await request(app)
        .post("/auth/register")
        .send({
          email,
          password: "Test123!",
          firstName: "Jane",
          lastName: "Doe",
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("should reject missing required fields", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ email: "missing@test.com" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject weak password", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          email: `weak${Date.now()}@test.com`,
          password: "weak",
          firstName: "John",
          lastName: "Doe",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /auth/login", () => {
    it("should login with valid credentials", async () => {
      const email = `login${Date.now()}@test.com`;
      await request(app)
        .post("/auth/register")
        .send({
          email,
          password: "Test123!",
          firstName: "John",
          lastName: "Doe",
        });

      const res = await request(app)
        .post("/auth/login")
        .send({ email, password: "Test123!" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it("should reject wrong password", async () => {
      const email = `wrongpw${Date.now()}@test.com`;
      await request(app)
        .post("/auth/register")
        .send({
          email,
          password: "Test123!",
          firstName: "John",
          lastName: "Doe",
        });

      const res = await request(app)
        .post("/auth/login")
        .send({ email, password: "WrongPassword1" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject nonexistent email", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "nobody@test.com", password: "Test123!" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /auth/refresh", () => {
    it("should issue new tokens with valid refresh token", async () => {
      const email = `refresh${Date.now()}@test.com`;
      const signupRes = await request(app)
        .post("/auth/register")
        .send({
          email,
          password: "Test123!",
          firstName: "John",
          lastName: "Doe",
        });

      const refreshToken = signupRes.body.data.refreshToken;

      const res = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it("should reject missing refresh token", async () => {
      const res = await request(app)
        .post("/auth/refresh")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject invalid refresh token", async () => {
      const res = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken: "invalidtoken123" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /auth/forgot-password", () => {
    it("should return success for valid email without leaking info", async () => {
      const email = `forgot${Date.now()}@test.com`;
      await request(app)
        .post("/auth/register")
        .send({
          email,
          password: "Test123!",
          firstName: "John",
          lastName: "Doe",
        });

      const res = await request(app)
        .post("/auth/forgot-password")
        .send({ email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should return success even for nonexistent email (no info leak)", async () => {
      const res = await request(app)
        .post("/auth/forgot-password")
        .send({ email: "nonexistent@test.com" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("GET /auth/profile", () => {
    it("should return profile for authenticated user", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .get("/auth/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("email");
    });

    it("should return 401 without token", async () => {
      const res = await request(app).get("/auth/profile");

      expect(res.status).toBe(401);
    });
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd server && npm test -- --testPathPattern=auth
```

Expected: All auth tests pass.

- [ ] **Step 3: Commit**

```bash
git add server/src/tests/auth.test.ts
git commit -m "test: add auth endpoint tests (signup, login, refresh, forgot-password)"
```

---

### Task 3: User endpoint tests

**Files:**
- Create: `server/src/tests/user.test.ts`

**Interfaces:**
- Consumes: `app` from `server/src/index.ts`, `createTestUser` from `server/src/tests/helpers.ts`
- Produces: user test suite covering profile get, update, delete

- [ ] **Step 1: Create user.test.ts**

Create `server/src/tests/user.test.ts`:

```typescript
import request from "supertest";
import { app } from "../index";
import { createTestUser } from "./helpers";

describe("User API", () => {
  describe("PUT /users", () => {
    it("should update user profile", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .put("/users")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "Updated",
          lastName: "Name",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should reject update without auth", async () => {
      const res = await request(app)
        .put("/users")
        .send({ firstName: "Hacker" });

      expect(res.status).toBe(401);
    });

    it("should reject invalid field values", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .put("/users")
        .set("Authorization", `Bearer ${token}`)
        .send({ firstName: "A" }); // min 2 chars

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("DELETE /users", () => {
    it("should delete user account", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .delete("/users")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should reject delete without auth", async () => {
      const res = await request(app).delete("/users");

      expect(res.status).toBe(401);
    });
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd server && npm test -- --testPathPattern=user
```

Expected: All user tests pass.

- [ ] **Step 3: Commit**

```bash
git add server/src/tests/user.test.ts
git commit -m "test: add user profile endpoint tests (update, delete)"
```

---

### Task 4: Trainer endpoint tests

**Files:**
- Create: `server/src/tests/trainer.test.ts`

**Interfaces:**
- Consumes: `app` from `server/src/index.ts`, `createTestUser`, `createTestTrainer` from `server/src/tests/helpers.ts`
- Produces: trainer test suite covering create, get profile, update, search, get by public ID

- [ ] **Step 1: Create trainer.test.ts**

Create `server/src/tests/trainer.test.ts`:

```typescript
import request from "supertest";
import { app } from "../index";
import { createTestUser, createTestTrainer } from "./helpers";
import { Specialization } from "../models/specialization";

describe("Trainer API", () => {
  describe("POST /trainer/create", () => {
    it("should create a trainer profile", async () => {
      const { token } = await createTestUser();
      const specs = await Specialization.findAll({ limit: 1 });

      const res = await request(app)
        .post("/trainer/create")
        .set("Authorization", `Bearer ${token}`)
        .send({
          bio: "I am a fitness trainer with 5 years of experience.",
          experienceYears: 5,
          locationCity: "Bucharest",
          locationState: "Bucharest",
          locationCountry: "Romania",
          specializationIds: [specs[0].id],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data).toHaveProperty("bio");
    });

    it("should reject if user is already a trainer", async () => {
      const { token } = await createTestTrainer();
      const specs = await Specialization.findAll({ limit: 1 });

      const res = await request(app)
        .post("/trainer/create")
        .set("Authorization", `Bearer ${token}`)
        .send({
          bio: "Duplicate trainer",
          experienceYears: 3,
          locationCity: "Cluj",
          locationState: "Cluj",
          locationCountry: "Romania",
          specializationIds: [specs[0].id],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject without auth", async () => {
      const res = await request(app)
        .post("/trainer/create")
        .send({ bio: "No auth" });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /trainer (own profile)", () => {
    it("should return own trainer profile", async () => {
      const { token } = await createTestTrainer();

      const res = await request(app)
        .get("/trainer")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("bio");
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get("/trainer");

      expect(res.status).toBe(401);
    });
  });

  describe("GET /trainer/search", () => {
    it("should return trainers list", async () => {
      await createTestTrainer({ bio: "Searchable trainer bio" });

      const res = await request(app).get("/trainer/search");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should filter by text query", async () => {
      const uniqueBio = `UniqueSearchTerm${Date.now()}`;
      await createTestTrainer({ bio: uniqueBio });

      const res = await request(app)
        .get("/trainer/search")
        .query({ q: uniqueBio });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("GET /trainer/:trainerId (public)", () => {
    it("should return trainer by public ID", async () => {
      const { trainer } = await createTestTrainer();
      const publicId = trainer.publicId;

      const res = await request(app).get(`/trainer/${publicId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("bio");
    });

    it("should return 404 for nonexistent trainer", async () => {
      const res = await request(app).get("/trainer/nonexistent-uuid-1234");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd server && npm test -- --testPathPattern=trainer.test
```

Expected: All trainer tests pass.

- [ ] **Step 3: Commit**

```bash
git add server/src/tests/trainer.test.ts
git commit -m "test: add trainer endpoint tests (create, profile, search, getById)"
```

---

### Task 5: Trainer packages endpoint tests

**Files:**
- Create: `server/src/tests/trainerPackages.test.ts`

**Interfaces:**
- Consumes: `app` from `server/src/index.ts`, `createTestUser`, `createTestTrainer` from `server/src/tests/helpers.ts`
- Produces: trainer packages test suite covering CRUD, max limit, ownership, session rate recalculation

- [ ] **Step 1: Create trainerPackages.test.ts**

Create `server/src/tests/trainerPackages.test.ts`:

```typescript
import request from "supertest";
import { app } from "../index";
import { createTestUser, createTestTrainer } from "./helpers";
import { Trainer } from "../models/trainer";

describe("Trainer Packages API", () => {
  describe("POST /trainer-packages", () => {
    it("should create a package", async () => {
      const { trainer, token } = await createTestTrainer();

      const res = await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Starter Pack",
          price: 120,
          sessionCount: 4,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Starter Pack");
      expect(Number(res.body.data.price)).toBe(120);
      expect(res.body.data.sessionCount).toBe(4);
    });

    it("should reject if not a trainer", async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Fake Pack",
          price: 100,
          sessionCount: 2,
        });

      expect(res.status).toBe(403);
    });

    it("should reject without auth", async () => {
      const res = await request(app)
        .post("/trainer-packages")
        .send({ name: "No Auth", price: 50, sessionCount: 1 });

      expect(res.status).toBe(401);
    });

    it("should reject invalid data", async () => {
      const { token } = await createTestTrainer();

      const res = await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "",
          price: -5,
          sessionCount: 0,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should enforce max 5 packages", async () => {
      const { token } = await createTestTrainer();

      for (let i = 0; i < 5; i++) {
        await request(app)
          .post("/trainer-packages")
          .set("Authorization", `Bearer ${token}`)
          .send({
            name: `Pack ${i + 1}`,
            price: 100 + i * 10,
            sessionCount: i + 1,
          });
      }

      const res = await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Pack 6",
          price: 200,
          sessionCount: 6,
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /trainer-packages/:trainerId", () => {
    it("should return packages for a trainer", async () => {
      const { trainer, token } = await createTestTrainer();

      await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Gold", price: 200, sessionCount: 8 });

      const res = await request(app)
        .get(`/trainer-packages/${trainer.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe("Gold");
    });

    it("should return empty array for trainer with no packages", async () => {
      const { trainer } = await createTestTrainer();

      const res = await request(app)
        .get(`/trainer-packages/${trainer.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe("PUT /trainer-packages/:id", () => {
    it("should update a package", async () => {
      const { token } = await createTestTrainer();

      const createRes = await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Original", price: 100, sessionCount: 4 });

      const pkgId = createRes.body.data.id;

      const res = await request(app)
        .put(`/trainer-packages/${pkgId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated", price: 150 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Updated");
      expect(Number(res.body.data.price)).toBe(150);
    });

    it("should reject update from non-owner", async () => {
      const { token: ownerToken } = await createTestTrainer();
      const { token: otherToken } = await createTestTrainer();

      const createRes = await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Owner Pack", price: 100, sessionCount: 2 });

      const pkgId = createRes.body.data.id;

      const res = await request(app)
        .put(`/trainer-packages/${pkgId}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ name: "Stolen" });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /trainer-packages/:id", () => {
    it("should delete a package", async () => {
      const { token } = await createTestTrainer();

      const createRes = await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "ToDelete", price: 80, sessionCount: 2 });

      const pkgId = createRes.body.data.id;

      const res = await request(app)
        .delete(`/trainer-packages/${pkgId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should reject delete from non-owner", async () => {
      const { token: ownerToken } = await createTestTrainer();
      const { token: otherToken } = await createTestTrainer();

      const createRes = await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Not Yours", price: 100, sessionCount: 3 });

      const pkgId = createRes.body.data.id;

      const res = await request(app)
        .delete(`/trainer-packages/${pkgId}`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("Session rate recalculation", () => {
    it("should set sessionRate to lowest per-session price", async () => {
      const { trainer, token } = await createTestTrainer();

      await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Basic", price: 120, sessionCount: 4 });

      await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Premium", price: 200, sessionCount: 10 });

      const updated = await Trainer.findByPk(trainer.id);
      // Basic: 120/4 = 30, Premium: 200/10 = 20 → lowest is 20
      expect(Number(updated!.sessionRate)).toBe(20);
    });

    it("should set sessionRate to null when all packages deleted", async () => {
      const { trainer, token } = await createTestTrainer();

      const createRes = await request(app)
        .post("/trainer-packages")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Solo", price: 50, sessionCount: 1 });

      const pkgId = createRes.body.data.id;

      await request(app)
        .delete(`/trainer-packages/${pkgId}`)
        .set("Authorization", `Bearer ${token}`);

      const updated = await Trainer.findByPk(trainer.id);
      expect(updated!.sessionRate).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd server && npm test -- --testPathPattern=trainerPackages
```

Expected: All trainer packages tests pass.

- [ ] **Step 3: Run the full test suite**

```bash
cd server && npm test
```

Expected: All test files pass (auth, user, trainer, trainerPackages).

- [ ] **Step 4: Commit**

```bash
git add server/src/tests/trainerPackages.test.ts
git commit -m "test: add trainer packages endpoint tests (CRUD, limits, ownership, session rate)"
```
