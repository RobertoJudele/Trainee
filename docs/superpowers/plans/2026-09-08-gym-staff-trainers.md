# Gym Staff Trainers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A gym's employed trainers appear in their own labelled section at the top of the gym's map pin, granted by admin review rather than self-declaration.

**Architecture:** Four columns on the existing `trainer_gyms` join row carry a request/approval lifecycle (`none → pending → approved|rejected`). The server returns one rating-sorted trainer array with each row's `staffStatus`; the client partitions it into two sections. Gym pins additionally adopt the active-subscription scope that search already uses.

**Tech Stack:** Express 5 + TypeScript + Sequelize (sequelize-typescript) + PostgreSQL/PostGIS; React Native (Expo) + Redux Toolkit Query; Jest + supertest.

**Spec:** `docs/superpowers/specs/2026-09-08-gym-staff-trainers-design.md`

## Global Constraints

- **Migrations are manual.** The server boots `sequelize.sync({ alter: false })` (`server/src/db.ts:48`). New columns are NOT created on an existing database. `server/migrations/004_*.sql` must run per environment before the build ships. Tests are unaffected — `server/src/tests/setup.ts` uses `sync({ force: true })`.
- **Subscription filtering goes through the scope helper only.** Use `Trainer.scope("active")`. Never hand-roll a `subscriptionStatus` + `trialEndsAt` where — `server/src/tests/noHandRolledSubscriptionFilter.test.ts` fails the build if you do.
- **Status columns are PG enums** in this codebase (`trainer.ts:148`, `issue.ts:72`). Sequelize names the type `enum_trainer_gyms_staff_status`.
- **Every user-facing string is translated**, EN and RO, in `frontend/src/lib/i18n/translations.ts`. Romanian is the default and addresses the user as *tu*. Terminology per `docs/marketing/brief-produs-factual.md` §6: "sală", "antrenor" — never "platformă".
- **Route order:** any literal path under `/gyms` must be registered before `/gyms/:gymId`, or Express matches it as a `gymId`.
- Server test command: `cd server && npm test -- <path>`. Frontend typecheck: `cd frontend && npx tsc --noEmit`.

---

### Task 1: Staff columns on `trainer_gyms`

**Files:**
- Modify: `server/src/models/trainerGym.ts`
- Modify: `server/src/types/gym.ts:41-54`
- Create: `server/migrations/004_add_trainer_gym_staff.sql`
- Test: `server/src/tests/gymStaff.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `GymStaffStatus = "none" | "pending" | "approved" | "rejected"` exported from `server/src/types/gym.ts`; `TrainerGym.staffStatus`, `.staffRequestedAt`, `.staffReviewedAt`, `.staffReviewedBy`.

- [ ] **Step 1: Write the failing test**

Create `server/src/tests/gymStaff.test.ts`:

```ts
import { describe, it, expect } from "@jest/globals";
import { TrainerGym } from "../models/trainerGym";
import { createTestGym, createTestTrainer } from "./helpers";

describe("trainer_gyms staff columns", () => {
  it("defaults a new affiliation to 'none' with no review metadata", async () => {
    const { trainer } = await createTestTrainer();
    const { gym } = await createTestGym();

    const row = await TrainerGym.create({
      trainerId: trainer.id,
      gymId: gym.id,
      isAvailable: true,
    });

    expect(row.staffStatus).toBe("none");
    expect(row.staffRequestedAt).toBeNull();
    expect(row.staffReviewedAt).toBeNull();
    expect(row.staffReviewedBy).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- src/tests/gymStaff.test.ts`
Expected: FAIL — `row.staffStatus` is `undefined`.

- [ ] **Step 3: Add the type union**

In `server/src/types/gym.ts`, above `TrainerGymAttributes`:

```ts
export type GymStaffStatus = "none" | "pending" | "approved" | "rejected";
```

Then extend both interfaces:

```ts
export interface TrainerGymAttributes {
  id: number;
  trainerId: number;
  gymId: number;
  isAvailable: boolean; // trainer is currently available at this gym
  staffStatus: GymStaffStatus;
  staffRequestedAt: Date | null;
  staffReviewedAt: Date | null;
  staffReviewedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainerGymCreationAttributes {
  trainerId: number;
  gymId: number;
  isAvailable?: boolean;
  staffStatus?: GymStaffStatus;
  staffRequestedAt?: Date | null;
  staffReviewedAt?: Date | null;
  staffReviewedBy?: number | null;
}
```

- [ ] **Step 4: Add the model columns**

In `server/src/models/trainerGym.ts`, add `User` to the imports:

```ts
import { User } from "./user";
```

and change the attributes import to pull the union too:

```ts
import { GymStaffStatus, TrainerGymAttributes, TrainerGymCreationAttributes } from "../types/gym";
```

Then insert these columns after `isAvailable`:

```ts
  // Gym-staff affiliation. The trainer requests it; an admin approves.
  // Only "approved" affects ordering or client-visible rendering.
  @Default("none")
  @Column({
    type: DataType.ENUM("none", "pending", "approved", "rejected"),
    field: "staff_status",
  })
  staffStatus!: GymStaffStatus;

  @Column({ type: DataType.DATE, field: "staff_requested_at", allowNull: true })
  staffRequestedAt!: Date | null;

  @Column({ type: DataType.DATE, field: "staff_reviewed_at", allowNull: true })
  staffReviewedAt!: Date | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, field: "staff_reviewed_by", allowNull: true })
  staffReviewedBy!: number | null;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npm test -- src/tests/gymStaff.test.ts`
Expected: PASS

- [ ] **Step 6: Write the migration**

Create `server/migrations/004_add_trainer_gym_staff.sql`:

```sql
-- Gym-staff affiliation on trainer_gyms: a trainer requests it, an admin
-- approves, and approved trainers sort into their own section at the top of
-- the gym's map pin.
--
-- Why a manual SQL file: the app boots with sequelize.sync({ alter: false }),
-- so new columns are NOT added automatically on an existing database. Run this
-- once per environment BEFORE deploying the build that uses it, or every gym
-- query starts erroring on a missing column.
--
-- Local:  docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" < migrations/004_add_trainer_gym_staff.sql
-- Prod:   same, against the production db container (see server/DEPLOY.md).
--
-- Idempotent: safe to run multiple times.

-- Sequelize expects the enum type to be named enum_<table>_<column>.
DO $$ BEGIN
  CREATE TYPE enum_trainer_gyms_staff_status
    AS ENUM ('none', 'pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE trainer_gyms
  ADD COLUMN IF NOT EXISTS staff_status enum_trainer_gyms_staff_status
    NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS staff_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS staff_reviewed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS staff_reviewed_by  INTEGER
    REFERENCES users (id) ON DELETE SET NULL;

-- The read path only ever filters for approved rows.
CREATE INDEX IF NOT EXISTS trainer_gyms_gym_staff_idx
  ON trainer_gyms (gym_id) WHERE staff_status = 'approved';
```

- [ ] **Step 7: Commit**

```bash
git add server/src/models/trainerGym.ts server/src/types/gym.ts \
        server/migrations/004_add_trainer_gym_staff.sql \
        server/src/tests/gymStaff.test.ts
git commit -m "feat(gym): add staff affiliation columns to trainer_gyms"
```

---

### Task 2: Trainer requests staff status

**Files:**
- Modify: `server/src/controllers/gym.ts` (new export after `setGymAvailability`)
- Modify: `server/src/middleware/validation.ts` (after `gymAvailabilityValidation:659-670`)
- Modify: `server/src/routes/gym.ts`
- Test: `server/src/tests/gymStaff.test.ts`

**Interfaces:**
- Consumes: `TrainerGym.staffStatus`, `.staffRequestedAt` from Task 1.
- Produces: `requestGymStaff(req: AuthenticatedRequest, res: Response)`; `gymStaffRequestValidation`; route `POST /gyms/:gymId/staff-request`.

- [ ] **Step 1: Write the failing tests**

Append to `server/src/tests/gymStaff.test.ts`:

```ts
import request from "supertest";
import { app } from "../index";

describe("POST /gyms/:gymId/staff-request", () => {
  it("sets a joined trainer's affiliation to pending", async () => {
    const { token } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .post(`/gyms/${gym.id}/staff-request`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.staffStatus).toBe("pending");
    expect(res.body.data.staffRequestedAt).not.toBeNull();
  });

  it("rejects a request for a gym the trainer has not joined", async () => {
    const { token } = await createTestTrainer();
    const { gym } = await createTestGym();

    const res = await request(app)
      .post(`/gyms/${gym.id}/staff-request`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("is a no-op when already pending", async () => {
    const { token } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);
    await request(app).post(`/gyms/${gym.id}/staff-request`).set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .post(`/gyms/${gym.id}/staff-request`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.staffStatus).toBe("pending");
  });

  it("requires authentication", async () => {
    const { gym } = await createTestGym();
    const res = await request(app).post(`/gyms/${gym.id}/staff-request`);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npm test -- src/tests/gymStaff.test.ts`
Expected: FAIL — 404 from Express (route does not exist) on the first case.

- [ ] **Step 3: Add the controller**

In `server/src/controllers/gym.ts`, after `setGymAvailability`:

```ts
// ─────────────────────────────────────────────
// POST /gyms/:gymId/staff-request  — trainer asks to be listed as gym staff
// Grants nothing: an admin reviews it. Only "approved" ever affects ordering.
// ─────────────────────────────────────────────
export const requestGymStaff = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user!.id;
    const gymId = parseInt(req.params.gymId);

    if (isNaN(gymId)) {
      sendError(res, 400, "Invalid gym id");
      return;
    }

    const trainer = await Trainer.findOne({ where: { userId } });
    if (!trainer) {
      sendError(res, 404, "Trainer profile not found");
      return;
    }

    const trainerGym = await TrainerGym.findOne({
      where: { trainerId: trainer.id, gymId },
    });

    if (!trainerGym) {
      sendError(res, 404, "You are not registered at this gym");
      return;
    }

    // Already pending or approved — nothing to do, and not an error.
    if (
      trainerGym.staffStatus === "pending" ||
      trainerGym.staffStatus === "approved"
    ) {
      sendSuccess(res, 200, "Staff request already submitted", trainerGym);
      return;
    }

    await trainerGym.update({
      staffStatus: "pending",
      staffRequestedAt: new Date(),
      staffReviewedAt: null,
      staffReviewedBy: null,
    });

    sendSuccess(res, 200, "Staff request submitted", trainerGym);
  } catch (error) {
    console.error("requestGymStaff error:", error);
    sendError(res, 500, "Failed to submit staff request");
  }
};
```

- [ ] **Step 4: Add the validator**

In `server/src/middleware/validation.ts`, after `gymAvailabilityValidation` (ends line 670):

```ts
export const gymStaffRequestValidation = [
  param("gymId")
    .isInt({ min: 1 })
    .withMessage("gymId must be a positive integer."),
  strictSchema({ params: ["gymId"], body: [], query: [] }),
];
```

- [ ] **Step 5: Wire the route**

In `server/src/routes/gym.ts`, add `requestGymStaff` to the controller import and `gymStaffRequestValidation` to the validation import, then register it beside the other trainer routes (after the `availability` route):

```ts
router.post(
  "/:gymId/staff-request",
  authenticate,
  subscription,
  gymStaffRequestValidation,
  handleValidationErrors,
  requestGymStaff
);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd server && npm test -- src/tests/gymStaff.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 7: Commit**

```bash
git add server/src/controllers/gym.ts server/src/middleware/validation.ts \
        server/src/routes/gym.ts server/src/tests/gymStaff.test.ts
git commit -m "feat(gym): trainers can request gym-staff status"
```

---

### Task 3: Admin reviews staff requests

**Files:**
- Modify: `server/src/controllers/gym.ts`
- Modify: `server/src/middleware/validation.ts`
- Modify: `server/src/routes/gym.ts`
- Test: `server/src/tests/gymStaff.test.ts`

**Interfaces:**
- Consumes: `requestGymStaff` route from Task 2.
- Produces: `reviewGymStaff`, `listGymStaffRequests`; routes `PATCH /gyms/:gymId/staff-request/:trainerId` and `GET /gyms/staff-requests`.

- [ ] **Step 1: Write the failing tests**

Append to `server/src/tests/gymStaff.test.ts` (add `createTestAdmin`, `createTestUser` to the `./helpers` import):

```ts
describe("PATCH /gyms/:gymId/staff-request/:trainerId", () => {
  const joinAndRequest = async () => {
    const { token, trainer } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);
    await request(app).post(`/gyms/${gym.id}/staff-request`).set("Authorization", `Bearer ${token}`);
    return { trainer, gym };
  };

  it("lets an admin approve a request", async () => {
    const { trainer, gym } = await joinAndRequest();
    const { token: adminToken, user: admin } = await createTestAdmin();

    const res = await request(app)
      .patch(`/gyms/${gym.id}/staff-request/${trainer.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ approve: true });

    expect(res.status).toBe(200);
    expect(res.body.data.staffStatus).toBe("approved");
    expect(res.body.data.staffReviewedBy).toBe(admin.id);
    expect(res.body.data.staffReviewedAt).not.toBeNull();
  });

  it("lets an admin reject a request", async () => {
    const { trainer, gym } = await joinAndRequest();
    const { token: adminToken } = await createTestAdmin();

    const res = await request(app)
      .patch(`/gyms/${gym.id}/staff-request/${trainer.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ approve: false });

    expect(res.status).toBe(200);
    expect(res.body.data.staffStatus).toBe("rejected");
  });

  it("allows re-requesting after a rejection", async () => {
    const { token, trainer } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);
    await request(app).post(`/gyms/${gym.id}/staff-request`).set("Authorization", `Bearer ${token}`);
    const { token: adminToken } = await createTestAdmin();
    await request(app)
      .patch(`/gyms/${gym.id}/staff-request/${trainer.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ approve: false });

    const res = await request(app)
      .post(`/gyms/${gym.id}/staff-request`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.staffStatus).toBe("pending");
  });

  it("rejects a non-admin reviewer", async () => {
    const { trainer, gym } = await joinAndRequest();
    const { token: clientToken } = await createTestUser();

    const res = await request(app)
      .patch(`/gyms/${gym.id}/staff-request/${trainer.id}`)
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ approve: true });

    expect(res.status).toBe(403);
  });

  it("drops the affiliation when the trainer leaves, and rejoining starts at none", async () => {
    const { token, trainer } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);
    await request(app).post(`/gyms/${gym.id}/staff-request`).set("Authorization", `Bearer ${token}`);
    const { token: adminToken } = await createTestAdmin();
    await request(app)
      .patch(`/gyms/${gym.id}/staff-request/${trainer.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ approve: true });

    await request(app).delete(`/gyms/${gym.id}/leave`).set("Authorization", `Bearer ${token}`);
    expect(await TrainerGym.findOne({ where: { trainerId: trainer.id, gymId: gym.id } })).toBeNull();

    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);
    const rejoined = await TrainerGym.findOne({
      where: { trainerId: trainer.id, gymId: gym.id },
    });
    expect(rejoined!.staffStatus).toBe("none");
  });
});

describe("GET /gyms/staff-requests", () => {
  it("lists pending requests for an admin", async () => {
    const { token, trainer } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);
    await request(app).post(`/gyms/${gym.id}/staff-request`).set("Authorization", `Bearer ${token}`);
    const { token: adminToken } = await createTestAdmin();

    const res = await request(app)
      .get("/gyms/staff-requests")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const match = res.body.data.find(
      (r: any) => r.trainerId === trainer.id && r.gymId === gym.id
    );
    expect(match).toBeDefined();
    expect(match.gymName).toBe(gym.name);
  });

  it("rejects a non-admin", async () => {
    const { token } = await createTestTrainer();
    const res = await request(app)
      .get("/gyms/staff-requests")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npm test -- src/tests/gymStaff.test.ts`
Expected: FAIL — routes do not exist.

- [ ] **Step 3: Add the controllers**

In `server/src/controllers/gym.ts`, after `requestGymStaff`:

```ts
// ─────────────────────────────────────────────
// PATCH /gyms/:gymId/staff-request/:trainerId  — admin approves or rejects
// ─────────────────────────────────────────────
export const reviewGymStaff = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const gymId = parseInt(req.params.gymId);
    const trainerId = parseInt(req.params.trainerId);
    const { approve } = req.body as { approve: boolean };

    if (isNaN(gymId) || isNaN(trainerId)) {
      sendError(res, 400, "Invalid gym or trainer id");
      return;
    }

    if (typeof approve !== "boolean") {
      sendError(res, 400, "approve must be a boolean");
      return;
    }

    const trainerGym = await TrainerGym.findOne({ where: { trainerId, gymId } });
    if (!trainerGym) {
      sendError(res, 404, "No affiliation between this trainer and gym");
      return;
    }

    await trainerGym.update({
      staffStatus: approve ? "approved" : "rejected",
      staffReviewedAt: new Date(),
      staffReviewedBy: req.user!.id,
    });

    // Staff status changes pin ordering, which the bulk gym cache feeds.
    invalidateGymCache();
    sendSuccess(
      res,
      200,
      approve ? "Staff request approved" : "Staff request rejected",
      trainerGym
    );
  } catch (error) {
    console.error("reviewGymStaff error:", error);
    sendError(res, 500, "Failed to review staff request");
  }
};

// ─────────────────────────────────────────────
// GET /gyms/staff-requests  — admin queue of pending staff requests
// ─────────────────────────────────────────────
export const listGymStaffRequests = async (_req: Request, res: Response) => {
  try {
    const pending = await TrainerGym.findAll({
      where: { staffStatus: "pending" },
      attributes: ["id", "trainerId", "gymId", "staffRequestedAt"],
      include: [
        { model: Gym, attributes: ["name", "city"] },
        {
          model: Trainer,
          attributes: ["id"],
          include: [{ model: User, attributes: ["firstName", "lastName"] }],
        },
      ],
      order: [["staffRequestedAt", "ASC"]],
    });

    const data = pending.map((tg) => {
      const trainerUser = (tg.trainer as any)?.user;
      return {
        id: tg.id,
        trainerId: tg.trainerId,
        gymId: tg.gymId,
        staffRequestedAt: tg.staffRequestedAt,
        gymName: (tg.gym as any)?.name ?? "",
        gymCity: (tg.gym as any)?.city ?? "",
        trainerName: `${trainerUser?.firstName ?? ""} ${trainerUser?.lastName ?? ""}`.trim(),
      };
    });

    sendSuccess(res, 200, "Staff requests retrieved successfully", data);
  } catch (error) {
    console.error("listGymStaffRequests error:", error);
    sendError(res, 500, "Failed to retrieve staff requests");
  }
};
```

- [ ] **Step 4: Add the validator**

In `server/src/middleware/validation.ts`, after `gymStaffRequestValidation`:

```ts
export const gymStaffReviewValidation = [
  param("gymId")
    .isInt({ min: 1 })
    .withMessage("gymId must be a positive integer."),
  param("trainerId")
    .isInt({ min: 1 })
    .withMessage("trainerId must be a positive integer."),
  body("approve")
    .isBoolean()
    .withMessage("approve must be a boolean."),
  strictSchema({
    params: ["gymId", "trainerId"],
    body: ["approve"],
  }),
];
```

- [ ] **Step 5: Wire the routes**

In `server/src/routes/gym.ts`, import `reviewGymStaff` and `listGymStaffRequests`, plus `gymStaffReviewValidation`.

Register the admin list **immediately after the `/my-gyms` line**, so it precedes `/:gymId`:

```ts
router.get("/staff-requests", authenticate, requireAdmin, listGymStaffRequests); // must come BEFORE /:gymId
```

Register the review route with the other admin routes:

```ts
router.patch(
  "/:gymId/staff-request/:trainerId",
  authenticate,
  requireAdmin,
  gymStaffReviewValidation,
  handleValidationErrors,
  reviewGymStaff
);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd server && npm test -- src/tests/gymStaff.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 7: Commit**

```bash
git add server/src/controllers/gym.ts server/src/middleware/validation.ts \
        server/src/routes/gym.ts server/src/tests/gymStaff.test.ts
git commit -m "feat(gym): admin review queue for gym-staff requests"
```

---

### Task 4: Expose `staffStatus` and order pins deterministically

**Files:**
- Modify: `server/src/controllers/gym.ts:169-195` (`getGymById`), `:220-233` (`getMyGyms`)
- Test: `server/src/tests/gymStaff.test.ts`

**Interfaces:**
- Consumes: `TrainerGym.staffStatus` from Task 1; the review route from Task 3.
- Produces: `getGymById` trainer objects gain `staffStatus: GymStaffStatus`; `getMyGyms` rows gain `staffStatus`.

- [ ] **Step 1: Write the failing tests**

Append to `server/src/tests/gymStaff.test.ts`:

```ts
describe("staff status on gym reads", () => {
  it("exposes staffStatus on gym detail trainers", async () => {
    const { token } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);

    const res = await request(app).get(`/gyms/${gym.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.trainers[0].staffStatus).toBe("none");
  });

  it("reports a pending request as pending, not approved", async () => {
    const { token } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);
    await request(app).post(`/gyms/${gym.id}/staff-request`).set("Authorization", `Bearer ${token}`);

    const res = await request(app).get(`/gyms/${gym.id}`);

    expect(res.body.data.trainers[0].staffStatus).toBe("pending");
  });

  it("orders gym trainers by rankingScore descending", async () => {
    const { gym } = await createTestGym();
    const low = await createTestTrainer();
    const high = await createTestTrainer();
    await low.trainer.update({ rankingScore: 3.1 });
    await high.trainer.update({ rankingScore: 4.9 });
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${low.token}`);
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${high.token}`);

    const res = await request(app).get(`/gyms/${gym.id}`);

    expect(res.body.data.trainers.map((t: any) => t.id)).toEqual([
      high.trainer.id,
      low.trainer.id,
    ]);
  });

  it("exposes staffStatus on my-gyms", async () => {
    const { token } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .get("/gyms/my-gyms")
      .set("Authorization", `Bearer ${token}`);

    expect(res.body.data[0].staffStatus).toBe("none");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npm test -- src/tests/gymStaff.test.ts`
Expected: FAIL — `staffStatus` is `undefined`; order test fails or is flaky.

- [ ] **Step 3: Update `getGymById`**

In `server/src/controllers/gym.ts`, replace the `TrainerGym.findAll` call in `getGymById` with:

```ts
    // Fetch trainers linked to this gym with their availability.
    // Ordered by rankingScore (the Bayesian-shrunk rating search sorts by), so
    // the sequence is deterministic; the client groups staff into their own
    // section from staffStatus.
    const trainerGyms = await TrainerGym.findAll({
      where: { gymId },
      include: [
        {
          model: Trainer,
          attributes: [
            "id", "bio", "experienceYears", "hourlyRate",
            "sessionRate", "totalRating", "reviewCount",
            minSessionPriceAttribute("trainer"),
          ],
          include: [
            {
              model: User,
              attributes: ["firstName", "lastName", "profileImageUrl"],
            },
          ],
        },
      ],
      order: [[{ model: Trainer, as: "trainer" }, "rankingScore", "DESC"]],
    });
```

and the mapping just below it with:

```ts
    const trainers = trainerGyms.map((tg) => {
      const trainerJson = (tg.trainer as any)?.toJSON?.() ?? {};
      return {
        ...trainerJson,
        isAvailableAtGym: tg.isAvailable,
        staffStatus: tg.staffStatus,
      };
    });
```

- [ ] **Step 4: Update `getMyGyms`**

In the same file, in `getMyGyms`, replace the `data` mapping with:

```ts
    const data = trainerGyms.map((tg) => ({
      ...(tg.gym as any)?.toJSON?.(),
      isAvailable: tg.isAvailable,
      staffStatus: tg.staffStatus,
      trainerGymId: tg.id,
    }));
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && npm test -- src/tests/gymStaff.test.ts`
Expected: PASS (16 tests)

- [ ] **Step 6: Run the existing gym suite for regressions**

Run: `cd server && npm test -- src/tests/gym.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/src/controllers/gym.ts server/src/tests/gymStaff.test.ts
git commit -m "feat(gym): expose staffStatus and order pin trainers by ranking"
```

---

### Task 5: Scope gym pins to active subscriptions

**Files:**
- Modify: `server/src/controllers/gym.ts:106-116` (`getAllGyms` counts), `:169-195` (`getGymById`)
- Test: `server/src/tests/gymStaff.test.ts`

**Interfaces:**
- Consumes: `getGymById` shape from Task 4.
- Produces: no new symbols. Behaviour change — lapsed trainers vanish from both the pin list and the pin badge count.

**Note on the count test:** `getAllGyms` caches its non-geo response for 30s. Pass `?lat=&lng=` to take the geo path, which bypasses the cache.

- [ ] **Step 1: Write the failing tests**

Append to `server/src/tests/gymStaff.test.ts` (add `subStatus` to the imports: `import { subStatus } from "../types/trainer";`):

```ts
describe("active-subscription scoping on gym pins", () => {
  const lapse = async (trainer: any) => {
    await trainer.update({
      subscriptionStatus: subStatus.TRIAL,
      trialEndsAt: new Date(Date.now() - 60_000),
    });
  };

  it("hides a lapsed trainer from gym detail", async () => {
    const { token, trainer } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);
    await lapse(trainer);

    const res = await request(app).get(`/gyms/${gym.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.trainers).toEqual([]);
  });

  it("excludes a lapsed trainer from availableTrainerCount", async () => {
    const { token, trainer } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);
    await lapse(trainer);

    // Geo path bypasses the 30s bulk cache.
    const res = await request(app).get(`/gyms?lat=${gym.latitude}&lng=${gym.longitude}`);

    const row = res.body.data.find((g: any) => g.id === gym.id);
    expect(row.availableTrainerCount).toBe(0);
  });

  it("still counts an active trainer", async () => {
    const { token } = await createTestTrainer();
    const { gym } = await createTestGym();
    await request(app).post(`/gyms/${gym.id}/join`).set("Authorization", `Bearer ${token}`);

    const res = await request(app).get(`/gyms?lat=${gym.latitude}&lng=${gym.longitude}`);

    const row = res.body.data.find((g: any) => g.id === gym.id);
    expect(row.availableTrainerCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npm test -- src/tests/gymStaff.test.ts`
Expected: FAIL — lapsed trainer still returned; count is 1 not 0.

- [ ] **Step 3: Scope the `getGymById` include**

In `getGymById`, change the `Trainer` include to the scoped model, and mark it required so a lapsed trainer removes the row rather than yielding a null trainer:

```ts
        {
          model: Trainer.scope("active"),
          as: "trainer",
          required: true,
          attributes: [
            "id", "bio", "experienceYears", "hourlyRate",
            "sessionRate", "totalRating", "reviewCount",
            minSessionPriceAttribute("trainer"),
          ],
          include: [
            {
              model: User,
              attributes: ["firstName", "lastName", "profileImageUrl"],
            },
          ],
        },
```

The `order` clause stays as written in Task 4 — `{ model: Trainer, as: "trainer" }` still resolves the association by alias.

- [ ] **Step 4: Scope the `getAllGyms` count**

Replace the counts query in `getAllGyms`:

```ts
    // Attach available trainer count to each gym. Scoped to active
    // subscriptions so the pin badge matches the list inside the pin.
    const gymIds = gyms.map((g) => g.id);
    const counts = await TrainerGym.findAll({
      where: { gymId: { [Op.in]: gymIds }, isAvailable: true },
      attributes: ["gymId"],
      include: [
        {
          model: Trainer.scope("active"),
          as: "trainer",
          attributes: [],
          required: true,
        },
      ],
    });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && npm test -- src/tests/gymStaff.test.ts`
Expected: PASS (19 tests)

- [ ] **Step 6: Verify the guard tests still pass**

Run: `cd server && npm test -- src/tests/noHandRolledSubscriptionFilter.test.ts src/tests/activeSubscription.parity.test.ts src/tests/gym.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/src/controllers/gym.ts server/src/tests/gymStaff.test.ts
git commit -m "fix(gym): scope pin trainers and counts to active subscriptions"
```

---

### Task 6: Frontend types and API endpoints

**Files:**
- Modify: `frontend/features/gym/gymApiSlice.ts`
- Modify: `frontend/src/api/apiSlice.ts:124-141` (tagTypes)

**Interfaces:**
- Consumes: server routes from Tasks 2–5.
- Produces: `GymStaffStatus` type; `GymTrainer.staffStatus`; `MyGym.staffStatus`; `GymStaffRequest` interface; hooks `useRequestGymStaffMutation`, `useGetGymStaffRequestsQuery`, `useReviewGymStaffMutation`.

- [ ] **Step 1: Add the tag type**

In `frontend/src/api/apiSlice.ts`, add to the `tagTypes` array (after `"MyGyms"`):

```ts
    "GymStaffRequests",
```

- [ ] **Step 2: Extend the gym types**

In `frontend/features/gym/gymApiSlice.ts`, add above `GymTrainer`:

```ts
export type GymStaffStatus = "none" | "pending" | "approved" | "rejected";

export interface GymStaffRequest {
  id: number;
  trainerId: number;
  gymId: number;
  staffRequestedAt: string | null;
  gymName: string;
  gymCity: string;
  trainerName: string;
}
```

Add to `GymTrainer`, after `isAvailableAtGym`:

```ts
  /** Only "approved" renders in the gym's staff section. */
  staffStatus: GymStaffStatus;
```

Add to `MyGym`, after `isAvailable`:

```ts
  staffStatus: GymStaffStatus;
```

- [ ] **Step 3: Add the endpoints**

In the same file, inside `endpoints`, after `leaveGym`:

```ts
    // Ask to be listed as this gym's staff (admin reviews it)
    requestGymStaff: builder.mutation<ApiResponse<void>, number>({
      query: (gymId) => ({
        url: `/gyms/${gymId}/staff-request`,
        method: "POST",
      }),
      invalidatesTags: ["MyGyms", "GymStaffRequests"],
    }),

    // Admin: pending staff requests
    getGymStaffRequests: builder.query<ApiResponse<GymStaffRequest[]>, void>({
      query: () => "/gyms/staff-requests",
      providesTags: ["GymStaffRequests"],
    }),

    // Admin: approve or reject one
    reviewGymStaff: builder.mutation<
      ApiResponse<void>,
      { gymId: number; trainerId: number; approve: boolean }
    >({
      query: ({ gymId, trainerId, approve }) => ({
        url: `/gyms/${gymId}/staff-request/${trainerId}`,
        method: "PATCH",
        body: { approve },
      }),
      invalidatesTags: ["GymStaffRequests", "Gyms", "MyGyms"],
    }),
```

Add the three hooks to the export block at the bottom:

```ts
  useRequestGymStaffMutation,
  useGetGymStaffRequestsQuery,
  useReviewGymStaffMutation,
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/features/gym/gymApiSlice.ts frontend/src/api/apiSlice.ts
git commit -m "feat(gym): frontend types and endpoints for gym-staff status"
```

---

### Task 7: Translations

**Files:**
- Modify: `frontend/src/lib/i18n/translations.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: keys `gymStaffTrainers`, `otherTrainersHere`, `workForThisGym`, `staffRequestPending`, `staffApproved`, `staffRequestSent`, `tabStaffRequests`, `noStaffRequests`, `approve`, `reject`, `requestedOn`.

- [ ] **Step 1: Add the English strings**

In the `en` object, beside `trainersHere` (line 416):

```ts
  gymStaffTrainers: "The gym's trainers",
  otherTrainersHere: "Other trainers here",
  workForThisGym: "I work for this gym",
  staffRequestPending: "Staff request pending",
  staffApproved: "Listed as this gym's trainer",
  staffRequestSent: "Request sent — an admin will review it",
  tabStaffRequests: "Staff",
  noStaffRequests: "No pending staff requests",
  approve: "Approve",
  reject: "Reject",
  requestedOn: "Requested",
```

- [ ] **Step 2: Add the Romanian strings**

In the `ro` object, beside `trainersHere` (line 1276):

```ts
  gymStaffTrainers: "Antrenorii sălii",
  otherTrainersHere: "Alți antrenori aici",
  workForThisGym: "Lucrez pentru această sală",
  staffRequestPending: "Cerere în așteptare",
  staffApproved: "Ești listat ca antrenor al sălii",
  staffRequestSent: "Cerere trimisă — o va verifica un administrator",
  tabStaffRequests: "Antrenori sală",
  noStaffRequests: "Nicio cerere în așteptare",
  approve: "Aprobă",
  reject: "Respinge",
  requestedOn: "Cerută pe",
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/i18n/translations.ts
git commit -m "feat(i18n): strings for gym-staff trainers"
```

---

### Task 8: Two-section rendering on the gym pin

**Files:**
- Modify: `frontend/app/map.tsx:954` (key fix), `:1309-1327` (the trainer block)

**Interfaces:**
- Consumes: `GymTrainer.staffStatus` (Task 6), translation keys (Task 7).
- Produces: no exported symbols.

**Why the key changes:** `renderTrainerRow` uses `key={idx}`. Splitting one array into two sibling lists makes both start at index 0, so keys collide. Key by `trainer.id` instead.

- [ ] **Step 1: Fix the row key**

In `frontend/app/map.tsx`, in `renderTrainerRow`, change:

```tsx
      key={idx}
```

to:

```tsx
      key={trainer.id}
```

The `idx` parameter is now unused; change the signature from `(trainer: GymTrainer, idx: number)` to `(trainer: GymTrainer)`.

- [ ] **Step 2: Partition the trainers**

Add near the other `gymTrainers` derivation (around line 685):

```tsx
  const staffTrainers = useMemo(
    () => gymTrainers.filter((tr) => tr.staffStatus === "approved"),
    [gymTrainers]
  );
  const otherTrainers = useMemo(
    () => gymTrainers.filter((tr) => tr.staffStatus !== "approved"),
    [gymTrainers]
  );
```

(`useMemo` is already imported in this file.)

- [ ] **Step 3: Replace the trainer block**

Replace lines 1309-1327 (the `{/* Trainers */}` header plus the conditional list) with:

```tsx
            {/* Gym's own trainers */}
            {staffTrainers.length > 0 && (
              <>
                <View style={styles.trainersHeader}>
                  <Text style={styles.trainersTitle}>{t("gymStaffTrainers")}</Text>
                  <View style={styles.trainerCountBadge}>
                    <Text style={styles.trainerCountText}>
                      {staffTrainers.length}
                    </Text>
                  </View>
                </View>
                {staffTrainers.map(renderTrainerRow)}
              </>
            )}

            {/* Everyone else listed here */}
            <View style={styles.trainersHeader}>
              <Text style={styles.trainersTitle}>
                {staffTrainers.length > 0 ? t("otherTrainersHere") : t("trainersHere")}
              </Text>
              <View style={styles.trainerCountBadge}>
                <Text style={styles.trainerCountText}>
                  {otherTrainers.length}
                </Text>
              </View>
            </View>

            {otherTrainers.length === 0 ? (
              <View style={styles.noTrainers}>
                <Text style={styles.noTrainersText}>
                  {t("noTrainersHere")}
                </Text>
              </View>
            ) : (
              otherTrainers.map(renderTrainerRow)
            )}
```

With no staff, this renders exactly as before: the `trainersHere` header, the same count, and the same empty state.

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app/map.tsx
git commit -m "feat(map): show a gym's own trainers in their own section"
```

---

### Task 9: Trainer-facing request action

**Files:**
- Modify: `frontend/app/my-gyms.tsx` (imports, handler, `renderMyGym` card)

**Interfaces:**
- Consumes: `useRequestGymStaffMutation`, `MyGym.staffStatus` (Task 6); translation keys (Task 7).
- Produces: no exported symbols.

- [ ] **Step 1: Import the mutation**

In `frontend/app/my-gyms.tsx`, add `useRequestGymStaffMutation` to the existing import from `../features/gym/gymApiSlice`, and add the hook beside the others (near line 55):

```tsx
  const [requestStaff, { isLoading: requestingStaff }] = useRequestGymStaffMutation();
```

- [ ] **Step 2: Add the handler**

Add beside the other handlers:

```tsx
  const handleRequestStaff = async (gymId: number) => {
    try {
      await requestStaff(gymId).unwrap();
      Alert.alert(t("success"), t("staffRequestSent"));
    } catch (err) {
      Alert.alert(t("error"), getApiErrorMessage(err));
    }
  };
```

If `getApiErrorMessage` is not already imported in this file, add:

```tsx
import { getApiErrorMessage } from "../src/lib/errors";
```

- [ ] **Step 3: Add the card row**

In `renderMyGym`, insert between the availability description block and the leave button:

```tsx
      {/* Gym-staff affiliation */}
      {item.staffStatus === "approved" ? (
        <View style={styles.staffRow}>
          <Ionicons name="ribbon" size={16} color="#059669" style={{ marginRight: 6 }} />
          <Text style={styles.staffText}>{t("staffApproved")}</Text>
        </View>
      ) : item.staffStatus === "pending" ? (
        <View style={styles.staffRow}>
          <Ionicons name="hourglass-outline" size={16} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
          <Text style={styles.staffText}>{t("staffRequestPending")}</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.staffBtn}
          onPress={() => handleRequestStaff(item.id)}
          disabled={requestingStaff}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t("workForThisGym")}
        >
          <Text style={styles.staffBtnText}>{t("workForThisGym")}</Text>
        </TouchableOpacity>
      )}
```

- [ ] **Step 4: Add the styles**

In the `StyleSheet.create` block, beside `availRow`:

```tsx
  staffRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    marginTop: 8,
  },
  staffText: { ...typography.caption, color: theme.colors.text },
  staffBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    alignItems: "center",
  },
  staffBtnText: { ...typography.caption, color: theme.colors.primary, fontWeight: "700" },
```

If `typography` is not imported in this file, add it to the existing `../src/lib/theme` import.

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/app/my-gyms.tsx
git commit -m "feat(my-gyms): trainers can request gym-staff status"
```

---

### Task 10: Admin review queue

**Files:**
- Modify: `frontend/app/admin-issues.tsx`

**Interfaces:**
- Consumes: `useGetGymStaffRequestsQuery`, `useReviewGymStaffMutation` (Task 6); translation keys (Task 7).
- Produces: no exported symbols.

- [ ] **Step 1: Import the hooks and add a tab**

In `frontend/app/admin-issues.tsx`, add:

```tsx
import {
  useGetGymStaffRequestsQuery,
  useReviewGymStaffMutation,
} from "../features/gym/gymApiSlice";
```

Widen the tab type and add the tab. Change `TARGET_TABS` to:

```tsx
type AdminTab = IssueTargetType | "staff";

const TARGET_TABS: Array<{ value: AdminTab; labelKey: string }> = [
  { value: "trainer", labelKey: "tabTrainer" },
  { value: "booking", labelKey: "tabBooking" },
  { value: "app", labelKey: "tabApp" },
  { value: "gym", labelKey: "tabGymRequests" },
  { value: "staff", labelKey: "tabStaffRequests" },
];
```

and the state declaration to:

```tsx
  const [activeTab, setActiveTab] = React.useState<AdminTab>("trainer");
```

- [ ] **Step 2: Add the query and handler**

Beside the existing hooks:

```tsx
  const { data: staffData } = useGetGymStaffRequestsQuery(undefined, {
    skip: !isAdmin || activeTab !== "staff",
  });
  const [reviewStaff, { isLoading: isReviewing }] = useReviewGymStaffMutation();

  const staffRequests = staffData?.data ?? [];

  const handleReviewStaff = async (
    gymId: number,
    trainerId: number,
    approve: boolean
  ) => {
    try {
      await reviewStaff({ gymId, trainerId, approve }).unwrap();
    } catch (err) {
      Alert.alert(t("error"), getApiErrorMessage(err));
    }
  };
```

- [ ] **Step 3: Render the staff queue**

The screen's body is a single `FlatList`. Render the staff queue as an alternative list when that tab is active — wrap the existing `return (<FlatList .../>)` so the staff tab returns its own list with the same header. Insert before the existing return:

```tsx
  if (activeTab === "staff") {
    return (
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.listContent}
        data={staffRequests}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View>
            <Text style={styles.heading}>{t("adminIssues")}</Text>
            <View style={styles.filterRow}>
              {TARGET_TABS.map((tab) => (
                <Pressable
                  key={tab.value}
                  style={[
                    styles.filterChip,
                    activeTab === tab.value && styles.filterChipActive,
                  ]}
                  onPress={() => setActiveTab(tab.value)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      activeTab === tab.value && styles.filterChipTextActive,
                    ]}
                  >
                    {t(tab.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t("noStaffRequests")}</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.trainerName}</Text>
            <Text style={styles.meta}>
              {item.gymName}
              {item.gymCity ? ` • ${item.gymCity}` : ""}
            </Text>
            {item.staffRequestedAt ? (
              <Text style={styles.meta}>
                {t("requestedOn")}{" "}
                {new Date(item.staffRequestedAt).toLocaleDateString()}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Pressable
                style={[styles.statusButton, styles.statusButtonActive]}
                onPress={() => handleReviewStaff(item.gymId, item.trainerId, true)}
                disabled={isReviewing}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t("approve")}
              >
                <Text style={styles.statusButtonTextActive}>{t("approve")}</Text>
              </Pressable>
              <Pressable
                style={styles.statusButton}
                onPress={() => handleReviewStaff(item.gymId, item.trainerId, false)}
                disabled={isReviewing}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t("reject")}
              >
                <Text style={styles.statusButtonText}>{t("reject")}</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    );
  }
```

Match `styles.heading` / `styles.listContent` to whatever the existing header block actually uses — read the current `ListHeaderComponent` and mirror it.

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/app/admin-issues.tsx
git commit -m "feat(admin): review queue for gym-staff requests"
```

---

### Task 11: Full verification

- [ ] **Step 1: Run the whole server suite**

Run: `cd server && npm test`
Expected: PASS, with no regressions in `gym.test.ts`, `recommendation.test.ts`, `trainer.test.ts`, `subscriptionGating.test.ts`, `noHandRolledSubscriptionFilter.test.ts`, `activeSubscription.parity.test.ts`.

- [ ] **Step 2: Typecheck both sides**

Run: `cd server && npm run typecheck`
Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Apply the migration locally and smoke-test**

```bash
cd server
docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" < migrations/004_add_trainer_gym_staff.sql
npm run dev
```

Then, against the dev server: join a gym as a trainer, POST the staff request, approve it as an admin, and confirm `GET /gyms/:gymId` returns that trainer first with `staffStatus: "approved"`.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "test(gym): verification fixes for gym-staff trainers"
```

---

## Deployment note

`server/migrations/004_add_trainer_gym_staff.sql` **must run in every environment before the server build that uses it**. Deploying the build first breaks every gym query with a missing-column error.
