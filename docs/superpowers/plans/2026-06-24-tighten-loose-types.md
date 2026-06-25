# Tighten Loose Types (`any` → specific) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace explicit `any` types across the frontend and server with specific types wherever a real type is available, leaving `any`/casts only where they are genuinely required.

**Architecture:** Two shared error-narrowing helpers (one per package) absorb the largest category — `catch (e: any)` blocks — so each call site becomes a one-line, DRY change to `catch (e: unknown)`. The remaining categories (Sequelize model associations, RTK Query response generics, Redux thunk signatures, Sequelize query-builder locals, and a handful of frontend prop/state types) are direct annotation swaps. Higher-risk modeling work (`where: any` mutation objects, `.toJSON() as any` response DTOs, third-party SDK gaps) is isolated into an explicitly-optional Tier 3 so the safe wins ship first.

**Tech Stack:** TypeScript (strict), React Native / Expo (frontend), Express + sequelize-typescript (server), Redux Toolkit + RTK Query, Jest (server tests).

## Global Constraints

- Both packages compile under `strict: true`; the server additionally sets `noImplicitAny: true`. There are **no implicit anys** — every fix targets an *explicit* `any`/cast. Copied verbatim from `frontend/tsconfig.json` and `server/tsconfig.json`.
- **Verification cycle for type-only changes** (replaces the usual "write a failing test" step): the typechecker is the test.
  - Frontend: `cd frontend && npm run typecheck` (`tsc --noEmit`) — must be green **before and after** each task.
  - Server: `cd server && npm run typecheck` (`tsc --noEmit`) **and** `cd server && npm test` (`jest --passWithNoTests --forceExit --detectOpenHandles`, 118 tests) — both green before and after each server task.
- **Behavior must not change.** Where tightening a type *exposes a latent bug* (noted in Tasks 4), fix it minimally and call it out in the commit message; do not refactor beyond the type fix.
- Do **not** touch the items in the "Intentionally Left As-Is" appendix unless explicitly doing Tier 3.
- `undefined` was investigated and is **out of scope**: every `: undefined` / `? x : undefined` occurrence is a legitimate optional-value expression or the React Navigation param convention (`frontend/src/types/navigation.ts`). Nothing to fix.

---

## File Structure

**New files:**
- `frontend/src/lib/errors.ts` — `getApiErrorMessage(error: unknown, fallback): string`. One responsibility: narrow caught/unwrapped errors to a display string.
- `server/src/utils/errors.ts` — `getSequelizeValidationErrors(error: unknown)` + `getErrorMessage(error: unknown, fallback)`. One responsibility: narrow caught errors to API-shaped validation errors / a message.

**Modified files (by task):**
- Task 2: `frontend` catch sites — `app/admin-issues.tsx`, `app/forgot-password.tsx`, `app/my-gyms.tsx`, `app/my-schedule.tsx`, `app/reset-password.tsx`, `app/report-issue.tsx`, `app/trainer-schedule.tsx`, `app/trainers/[id].tsx`, `app/trainer-schedule/[date].tsx`, `features/users/CreateTrainer.tsx`, `features/trainer/TrainerProfile.tsx`, `features/trainer/hooks/useTrainerImages.ts`, `src/screens/Login.tsx`, `src/screens/SignUp.tsx`, `src/lib/useProfilePictureUpload.ts`.
- Task 4: `server` catch sites — `controllers/auth.ts`, `controllers/clientPreference.ts`, `controllers/recommendation.ts`, `controllers/review.ts`, `controllers/specializations.ts`, `controllers/trainer.ts`, `controllers/trainerSpecialization.ts`, `controllers/user.ts`, `middleware/auth.ts`, `services/s3ImageService.ts`.
- Task 5: `server/src/middleware/errorHandler.ts`.
- Task 6: `server/src/models/trainer.ts`, `server/src/models/specialization.ts`.
- Task 7: `frontend/src/types/api.ts`, `frontend/features/gym/gymApiSlice.ts`, `frontend/features/trainer/trainerApiSlice.ts`, `frontend/features/support/issueApiSlice.ts`.
- Task 8: `frontend/features/users/usersApiSlicet.ts`.
- Task 9: `server/src/controllers/gym.ts`, `server/src/controllers/trainer.ts`.
- Task 10: `frontend/app/(auth)/Welcome.tsx`, `frontend/src/components/ProfileMenuModal.tsx`, `frontend/features/trainer/TrainerSchedule.tsx`, `frontend/src/screens/Home.tsx`, `frontend/features/users/CreateTrainer.tsx`.

---

## Scope Map

| Category | Tier | Task | Disposition |
|---|---|---|---|
| `catch (e: any)` (frontend, ~17 sites) | 1 | 1, 2 | Fix via helper → `unknown` |
| `catch (e: any)` (server, ~20 sites) | 1 | 3, 4 | Fix via helper → `unknown` |
| `errorHandler` `err: any` | 1 | 5 | Fix → `unknown` + narrowing |
| Model associations `any[]` | 1 | 6 | Fix → model types |
| RTK `ApiResponse<any>` / `transformResponse(response: any)` | 1 | 7 | Fix → specific generics |
| Redux thunk `dispatch/getState: any` | 1 | 8 | Fix → `AppDispatch`/`RootState` |
| Sequelize `attributes/order: any[]` | 2 | 9 | Fix → `FindAttributeOptions`/`Order` |
| Frontend prop/state `any` (icons, layouts, action flag) | 2 | 10 | Fix → component/RN types |
| `where: any` mutation objects | 3 | 11 (optional) | Higher-risk, gated by tsc |
| `.toJSON() as any` response DTOs | 3 | 12 (optional) | Requires augmented attribute types |
| Stripe/RevenueCat SDK, seeds, tests, FormData | — | Appendix | Intentionally left as-is |

---

### Task 1: Frontend error helper

**Files:**
- Create: `frontend/src/lib/errors.ts`

**Interfaces:**
- Produces: `getApiErrorMessage(error: unknown, fallback: string): string`

- [ ] **Step 1: Confirm baseline typecheck is green**

Run: `cd frontend && npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 2: Create the helper**

Create `frontend/src/lib/errors.ts`:

```ts
// Helpers for narrowing the `unknown` errors thrown by RTK Query's
// `.unwrap()` (a `FetchBaseQueryError | SerializedError`) or anything else
// caught in a `catch` block, into a user-displayable message.

interface ErrorWithDataMessage {
  data: { message?: unknown };
}

function hasDataMessage(error: unknown): error is ErrorWithDataMessage {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    return false;
  }
  const data = (error as { data: unknown }).data;
  return typeof data === "object" && data !== null && "message" in data;
}

/**
 * Extracts a human-readable message from an unknown error. Checks the RTK
 * Query `error.data.message` shape first, then a standard `Error.message`,
 * and finally returns `fallback`.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (hasDataMessage(error)) {
    const message = error.data.message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return fallback;
}
```

- [ ] **Step 3: Typecheck passes**

Run: `cd frontend && npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/errors.ts
git commit -m "refactor(types): add getApiErrorMessage error-narrowing helper"
```

---

### Task 2: Apply the frontend error helper to all catch sites

**Files:**
- Modify: the 15 frontend files listed under "Task 2" in File Structure.

**Interfaces:**
- Consumes: `getApiErrorMessage(error, fallback)` from Task 1.

Every site currently uses `catch (e: any)` and reads `e?.data?.message || <fallback>`. The transformation is uniform:

```ts
// BEFORE
} catch (error: any) {
  Alert.alert(t("error"), error?.data?.message || t("updateError"));
}

// AFTER
} catch (error: unknown) {
  Alert.alert(t("error"), getApiErrorMessage(error, t("updateError")));
}
```

**Preserve each site's existing fallback string and surrounding logic** — only the catch annotation and the message-extraction expression change. Add `import { getApiErrorMessage } from "<relative>/src/lib/errors";` to each file (path depth varies: from `app/` it's `../src/lib/errors`; from `app/trainers/` and `app/trainer-schedule/` it's `../../src/lib/errors`; from `features/trainer/` it's `../../src/lib/errors`; from `features/users/` it's `../../src/lib/errors`; from `features/trainer/hooks/` it's `../../../src/lib/errors`; from `src/screens/` it's `../lib/errors`; from `src/lib/` it's `./errors`).

- [ ] **Step 1: Confirm baseline typecheck is green**

Run: `cd frontend && npm run typecheck`
Expected: exits 0.

- [ ] **Step 2: Convert the uniform `?.data?.message` sites**

Apply the BEFORE→AFTER transform at each of these locations (annotation → `unknown`, expression → `getApiErrorMessage(<var>, <existing fallback>)`, add import):

- `src/screens/Login.tsx:74-76` — fallback `t('loginFailedMessage')`
- `src/screens/SignUp.tsx:61` — keep existing fallback
- `features/trainer/TrainerProfile.tsx:199-200` — fallback `t("updateError")`
- `features/trainer/TrainerProfile.tsx:251` — keep existing fallback
- `features/users/CreateTrainer.tsx:191` — keep existing fallback
- `features/trainer/hooks/useTrainerImages.ts:41,53` — keep existing fallbacks
- `src/lib/useProfilePictureUpload.ts:24,32` — keep existing fallbacks (import `./errors`)
- `app/my-gyms.tsx:78,89,109` — fallback `t("error")`
- `app/my-schedule.tsx:36,55` — keep existing fallbacks
- `app/admin-issues.tsx:49` — keep existing fallback
- `app/forgot-password.tsx:46` — keep existing fallback
- `app/reset-password.tsx:57` — keep existing fallback
- `app/report-issue.tsx:108` — keep existing fallback
- `app/trainer-schedule.tsx:140,165` — keep existing fallbacks
- `app/trainers/[id].tsx:250,265` — keep existing fallbacks

For any site that **does not** display a message (e.g. only logs or swallows), still change `: any` → `: unknown`; if the body then accesses a property, wrap with `getApiErrorMessage` or guard with `error instanceof Error`. Do not leave any `: any` behind.

- [ ] **Step 3: Handle the one non-message catch — `app/trainer-schedule/[date].tsx:341`**

This site reads `(error as any)?.data?.conflicts`. Define a local narrowing instead of the helper. At the top of the file (after imports) add:

```ts
interface SlotConflict {
  slotId: number;
  startTime: string;
  endTime: string;
}

function getConflicts(error: unknown): SlotConflict[] | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof (error as { data?: unknown }).data === "object" &&
    (error as { data?: unknown }).data !== null
  ) {
    const data = (error as { data: { conflicts?: unknown } }).data;
    return Array.isArray(data.conflicts) ? (data.conflicts as SlotConflict[]) : undefined;
  }
  return undefined;
}
```

Then change the catch to `catch (error: unknown)` and replace `(error as any)?.data?.conflicts as ...` with `getConflicts(error)`. **Before writing the `SlotConflict` shape, read lines 335–360 of the file** and match the actual fields consumed from each conflict; adjust the interface to those fields exactly.

- [ ] **Step 4: Typecheck passes**

Run: `cd frontend && npm run typecheck`
Expected: exits 0. (If a site fails because it accessed a field other than `message`, narrow that site explicitly rather than re-widening to `any`.)

- [ ] **Step 5: Commit**

```bash
git add frontend/app frontend/features frontend/src
git commit -m "refactor(types): narrow frontend catch clauses to unknown"
```

---

### Task 3: Server error helpers

**Files:**
- Create: `server/src/utils/errors.ts`

**Interfaces:**
- Produces:
  - `getSequelizeValidationErrors(error: unknown): ValidationError[] | null`
  - `getErrorMessage(error: unknown, fallback: string): string`
  - (`ValidationError` is the existing interface in `server/src/types/common.ts`: `{ field: string; message: string }`.)

- [ ] **Step 1: Confirm baseline typecheck + tests are green**

Run: `cd server && npm run typecheck && npm test`
Expected: typecheck exits 0; jest reports all suites passing.

- [ ] **Step 2: Create the helper**

Create `server/src/utils/errors.ts`:

```ts
import { ValidationError as SequelizeValidationError } from "sequelize";
import { ValidationError } from "../types/common";

/**
 * If `error` is a Sequelize validation or unique-constraint error, returns
 * the field-level messages in our API shape; otherwise returns `null`.
 * (Sequelize's `UniqueConstraintError` extends `ValidationError`, so both
 * are covered by the single `instanceof` check.)
 */
export function getSequelizeValidationErrors(
  error: unknown
): ValidationError[] | null {
  if (error instanceof SequelizeValidationError) {
    return error.errors.map((item) => ({
      field: item.path ?? "",
      message: item.message,
    }));
  }
  return null;
}

/** Best-effort extraction of a message from an unknown error. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return fallback;
}
```

- [ ] **Step 3: Typecheck + tests pass**

Run: `cd server && npm run typecheck && npm test`
Expected: typecheck exits 0; all jest suites pass.

- [ ] **Step 4: Commit**

```bash
git add server/src/utils/errors.ts
git commit -m "refactor(types): add server error-narrowing helpers"
```

---

### Task 4: Apply server error helpers to all controller catch sites

**Files:**
- Modify: the 10 server files listed under "Task 4" in File Structure.

**Interfaces:**
- Consumes: `getSequelizeValidationErrors`, `getErrorMessage` from Task 3.

The current server pattern is:

```ts
} catch (error: any) {
  console.error(error);
  if (error.name === "SequelizeValidationError") {
    const errors = error.errors.map((err: any) => ({ field: err.path, message: err.message }));
    sendError(res, 400, "Validation failed");   // <-- note: `errors` is often computed then DISCARDED
    return;
  }
  sendError(res, 500, "Error ...");
}
```

Replace with:

```ts
} catch (error: unknown) {
  console.error(error);
  const validationErrors = getSequelizeValidationErrors(error);
  if (validationErrors) {
    sendError(res, 400, "Validation failed", validationErrors);
    return;
  }
  sendError(res, 500, "Error ...");
}
```

Add `import { getSequelizeValidationErrors } from "../utils/errors";` to each controller (depth: controllers and middleware/services are all one level under `src`, so `../utils/errors`).

**Two latent bugs this surfaces — fix them as part of this task:**
1. Several sites compute `errors` then call `sendError(res, 400, "Validation failed")` *without* passing it. Passing `validationErrors` (as above) is the intended behavior.
2. `controllers/review.ts:147` calls `sendError(res, 400, errors)` — passing the **array as the `message`** (a string param). With `sendError` typed, this is now a compile error. Fix to `sendError(res, 400, "Validation failed", errors)` where `errors` is the `validationErrors` from the helper.

- [ ] **Step 1: Confirm baseline typecheck + tests are green**

Run: `cd server && npm run typecheck && npm test`
Expected: both green.

- [ ] **Step 2: Convert the validation-error catch sites**

Apply the transform at each location (annotation → `unknown`, replace the name-check + manual `.map` with the helper, pass `validationErrors` into `sendError`, add import):

- `controllers/auth.ts:78-81`
- `controllers/clientPreference.ts:19, 89`
- `controllers/recommendation.ts:295`
- `controllers/review.ts:100-110, 140-148 (incl. bug #2), 192-195`
- `controllers/specializations.ts:15`
- `controllers/trainer.ts:410-413, 545, 621-624, 760-763, 806-809, 1197`
- `controllers/trainerSpecialization.ts:87-90, 152`
- `controllers/user.ts:33-36, 143-146`

- [ ] **Step 3: Convert the non-validation catch sites**

These catch blocks don't do Sequelize-validation handling — just change `: any` → `: unknown`, and if the body reads `error.message`, use `getErrorMessage(error, "<existing fallback>")`:

- `middleware/auth.ts:35`
- `services/s3ImageService.ts:131`

- [ ] **Step 4: Typecheck + tests pass**

Run: `cd server && npm run typecheck && npm test`
Expected: typecheck exits 0; **all 118 tests still pass** (confirms the validation-response change didn't break expectations). If a test asserted the *absence* of an `errors` array on a 400, update the assertion to expect the field errors (the new, correct behavior) and note it in the commit.

- [ ] **Step 5: Commit**

```bash
git add server/src/controllers server/src/middleware/auth.ts server/src/services/s3ImageService.ts
git commit -m "refactor(types): narrow server catch clauses to unknown; pass validation errors through"
```

---

### Task 5: Type the global error handler

**Files:**
- Modify: `server/src/middleware/errorHandler.ts`

**Interfaces:**
- Consumes: `getSequelizeValidationErrors` from Task 3.

- [ ] **Step 1: Confirm baseline typecheck + tests are green**

Run: `cd server && npm run typecheck && npm test`
Expected: both green.

- [ ] **Step 2: Replace the body with strict narrowing**

Replace the file contents of `server/src/middleware/errorHandler.ts` with:

```ts
// server/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response";
import { getSequelizeValidationErrors } from "../utils/errors";

function getStatusCode(err: unknown): number {
  if (typeof err === "object" && err !== null) {
    const e = err as { statusCode?: unknown; status?: unknown };
    if (typeof e.statusCode === "number") return e.statusCode;
    if (typeof e.status === "number") return e.status;
  }
  return 500;
}

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("💥 Unhandled Server Error:", err);

  // If headers have already been sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle Sequelize validation / unique-constraint errors
  const validationErrors = getSequelizeValidationErrors(err);
  if (validationErrors) {
    const message = err instanceof Error ? err.message : "Database validation failed";
    sendError(res, 400, message || "Database validation failed", validationErrors);
    return;
  }

  // Handle JWT errors
  if (err instanceof Error && err.name === "JsonWebTokenError") {
    sendError(res, 401, "Invalid authentication token");
    return;
  }
  if (err instanceof Error && err.name === "TokenExpiredError") {
    sendError(res, 401, "Authentication token has expired");
    return;
  }

  // Generic internal server error
  const statusCode = getStatusCode(err);
  const message =
    process.env.NODE_ENV === "production"
      ? "An unexpected error occurred. Please try again."
      : err instanceof Error
        ? err.message || "Internal Server Error"
        : "Internal Server Error";

  sendError(res, statusCode, message);
};
```

- [ ] **Step 3: Typecheck + tests pass**

Run: `cd server && npm run typecheck && npm test`
Expected: both green.

- [ ] **Step 4: Commit**

```bash
git add server/src/middleware/errorHandler.ts
git commit -m "refactor(types): type errorHandler err param as unknown with narrowing"
```

---

### Task 6: Type model associations

**Files:**
- Modify: `server/src/models/trainer.ts:176`, `server/src/models/specialization.ts:70`

- [ ] **Step 1: Confirm baseline typecheck + tests are green**

Run: `cd server && npm run typecheck && npm test`
Expected: both green.

- [ ] **Step 2: Type `Trainer.specializations`**

In `server/src/models/trainer.ts`, add a type-only import near the top with the other imports:

```ts
import type { Specialization } from "./specialization";
```

(Use `import type` so the existing lazy `require("./specialization")` inside the decorator stays the runtime source and no value-level circular import is introduced.)

Then change line 176:

```ts
// BEFORE
specializations!: any[];
// AFTER
specializations!: Specialization[];
```

- [ ] **Step 3: Type `Specialization.trainers`**

In `server/src/models/specialization.ts`, `Trainer` is already imported (line 13). Change line 70:

```ts
// BEFORE
trainers!: any[];
// AFTER
trainers!: Trainer[];
```

- [ ] **Step 4: Typecheck + tests pass**

Run: `cd server && npm run typecheck && npm test`
Expected: both green.

- [ ] **Step 5: Commit**

```bash
git add server/src/models/trainer.ts server/src/models/specialization.ts
git commit -m "refactor(types): type model BelongsToMany associations"
```

---

### Task 7: Type RTK Query response generics & transformResponse

**Files:**
- Modify: `frontend/src/types/api.ts` (add envelope type), `frontend/features/gym/gymApiSlice.ts`, `frontend/features/trainer/trainerApiSlice.ts`, `frontend/features/support/issueApiSlice.ts`

**Interfaces:**
- Produces: `ApiEnvelope<T>` in `frontend/src/types/api.ts`.

- [ ] **Step 1: Confirm baseline typecheck is green**

Run: `cd frontend && npm run typecheck`
Expected: exits 0.

- [ ] **Step 2: Add the envelope type**

Append to `frontend/src/types/api.ts`:

```ts
/** Standard server response envelope: `{ success, message, data }`. */
export interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
}
```

- [ ] **Step 3: Fix `gymApiSlice.ts` `ApiResponse<any>` (3 sites)**

The `joinGym`, `setGymAvailability`, and `leaveGym` mutation results are never read by callers (they `.unwrap()` and ignore the value). Change all three result generics from `ApiResponse<any>` to `ApiResponse<void>`:

- line 109: `joinGym: builder.mutation<ApiResponse<void>, number>({`
- lines 118-120: `setGymAvailability: builder.mutation<ApiResponse<void>, { gymId: number; isAvailable: boolean }>({`
- line 131: `leaveGym: builder.mutation<ApiResponse<void>, number>({`

- [ ] **Step 4: Fix `trainerApiSlice.ts` `transformResponse` (2 sites)**

Import the envelope at the top of the file: `import { ApiEnvelope } from "../../src/types/api";` (the file already imports its other types — add to that import if convenient).

- lines 239-241 (`getTrainerById`, result type `PublicTrainerProfile`):

```ts
transformResponse: (response: ApiEnvelope<PublicTrainerProfile>) =>
  response.data ?? (response as unknown as PublicTrainerProfile),
```

- lines 268-270 (`getTrainerAnalytics`, result type `TrainerAnalyticsResponseData`):

```ts
transformResponse: (response: ApiEnvelope<TrainerAnalyticsResponseData>) =>
  response.data ?? (response as unknown as TrainerAnalyticsResponseData),
```

- [ ] **Step 5: Fix `issueApiSlice.ts` `transformResponse` (1 site)**

`updateIssueStatusAdmin` declares result type `IssueRecord` and the server wraps it under `data`. Change line 80:

```ts
transformResponse: (response: { data: IssueRecord }) => response.data,
```

(`IssueRecord` is already in scope in this file.)

- [ ] **Step 6: Typecheck passes**

Run: `cd frontend && npm run typecheck`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/api.ts frontend/features/gym/gymApiSlice.ts frontend/features/trainer/trainerApiSlice.ts frontend/features/support/issueApiSlice.ts
git commit -m "refactor(types): type RTK Query response generics and transformResponse"
```

---

### Task 8: Type the profile-picture thunk helper

**Files:**
- Modify: `frontend/features/users/usersApiSlicet.ts:9,17,18`

- [ ] **Step 1: Confirm baseline typecheck is green**

Run: `cd frontend && npm run typecheck`
Expected: exits 0.

- [ ] **Step 2: Replace the three `any`s with store + user types**

Add imports at the top of `frontend/features/users/usersApiSlicet.ts`:

```ts
import type { AppDispatch, RootState } from "../../app/store";
import type { User } from "../../src/types/user";
```

Change the `ProfilePictureResponse.data` shape (line 9):

```ts
// BEFORE
data?: { user: any };
// AFTER
data?: { user: User };
```

Change the `syncUserAfterPicture` signature (lines 17-18):

```ts
// BEFORE
  dispatch: any,
  getState: any
// AFTER
  dispatch: AppDispatch,
  getState: () => RootState
```

- [ ] **Step 3: Typecheck passes**

Run: `cd frontend && npm run typecheck`
Expected: exits 0. If `User` from `src/types/user` is not assignable to what `setCredentials` expects, switch the import to the same `User` type `features/auth/authSlice.ts` uses (re-export path), then re-run — do not fall back to `any`.

- [ ] **Step 4: Commit**

```bash
git add frontend/features/users/usersApiSlicet.ts
git commit -m "refactor(types): type profile-picture thunk dispatch/getState/user"
```

---

### Task 9: Type Sequelize attribute/order query locals

**Files:**
- Modify: `server/src/controllers/gym.ts:54,69`, `server/src/controllers/trainer.ts:1088,1117`

**Interfaces:**
- Consumes: Sequelize types `FindAttributeOptions`, `Order` (import from `"sequelize"`).

These four locals hold plain string lists plus `[Sequelize.literal(...), "alias"]` projection tuples / order tuples — exactly what `FindAttributeOptions` and `Order` model. (The `where: any` mutation objects in the same files are **Task 11**, not here.)

- [ ] **Step 1: Confirm baseline typecheck + tests are green**

Run: `cd server && npm run typecheck && npm test`
Expected: both green.

- [ ] **Step 2: `gym.ts` — type `attributes` and `order`**

Add `FindAttributeOptions, Order` to the existing `from "sequelize"` import (currently `import { Op, Sequelize } from "sequelize";`):

```ts
import { Op, Sequelize, FindAttributeOptions, Order } from "sequelize";
```

Change line 54: `const attributes: FindAttributeOptions = [` and line 69: `let order: Order = [["name", "ASC"]];`

- [ ] **Step 3: `trainer.ts` — type `trainerAttributes` and `orderClause`**

Ensure `FindAttributeOptions, Order` are imported from `"sequelize"` in `trainer.ts` (add to the existing sequelize import).

Change line 1088: `const trainerAttributes: FindAttributeOptions = [` and lines 1117-1120: `const orderClause: Order =` (the value expression is unchanged).

- [ ] **Step 4: Typecheck + tests pass**

Run: `cd server && npm run typecheck && npm test`
Expected: both green. If `order.push(...)` / `attributes.push([literal, alias])` triggers a variance error, keep the annotation and change the literal-tuple pushes to `as const` tuples or cast the single tuple (`[Sequelize.literal(x), "ASC"] as OrderItem`) — import `OrderItem`/`ProjectionAlias` as needed; do **not** revert to `any[]`.

- [ ] **Step 5: Commit**

```bash
git add server/src/controllers/gym.ts server/src/controllers/trainer.ts
git commit -m "refactor(types): type Sequelize attributes/order locals"
```

---

### Task 10: Type frontend prop & state `any`s

**Files:**
- Modify: `frontend/app/(auth)/Welcome.tsx:69`, `frontend/src/components/ProfileMenuModal.tsx:63`, `frontend/features/trainer/TrainerSchedule.tsx:75`, `frontend/src/screens/Home.tsx:106`, `frontend/features/users/CreateTrainer.tsx:161`

- [ ] **Step 1: Confirm baseline typecheck is green**

Run: `cd frontend && npm run typecheck`
Expected: exits 0.

- [ ] **Step 2: `Welcome.tsx` — icon prop is an Ionicons glyph name**

`icon` is rendered via `<Ionicons name={icon} .../>` (line 72). Change line 69's prop type:

```ts
// BEFORE
function FeatureItem({ icon, text, delay }: { icon: any; text: string; delay: number }) {
// AFTER
function FeatureItem({ icon, text, delay }: { icon: React.ComponentProps<typeof Ionicons>["name"]; text: string; delay: number }) {
```

Ensure `React` is imported (Expo RN files usually `import React from "react"`; if only the named hooks are imported, add `import type React from "react"` or use the already-imported `ComponentProps`). `Ionicons` is already imported in this file.

- [ ] **Step 3: `ProfileMenuModal.tsx` — icon cast**

Replace the `as any` cast on line 63 by typing the item's `icon` field. Find the menu-item type/array in this file and change its `icon` field type to `React.ComponentProps<typeof Ionicons>["name"]`, then remove the `as any`:

```ts
// BEFORE
name={item.icon as any}
// AFTER
name={item.icon}
```

If the item type is defined inline/elsewhere, set `icon: React.ComponentProps<typeof Ionicons>["name"]` at its definition.

- [ ] **Step 4: `TrainerSchedule.tsx` — slot layouts**

`slotLayouts` stores per-slot measured rectangles. Import `LayoutRectangle` from `react-native` and change line 75:

```ts
// BEFORE
const [slotLayouts, setSlotLayouts] = useState<{ [key: string]: any }>({});
// AFTER
const [slotLayouts, setSlotLayouts] = useState<Record<string, LayoutRectangle>>({});
```

**Before committing, confirm** the values written into `slotLayouts` (search `setSlotLayouts(` in this file) are `{ x, y, width, height }` from an `onLayout`/`measure` callback. If they additionally carry `pageX`/`pageY`, define `interface SlotLayout extends LayoutRectangle { pageX: number; pageY: number }` and use `Record<string, SlotLayout>` instead.

- [ ] **Step 5: `Home.tsx` — action flag cast**

Line 106 reads `(action as any).requiresAuth`. Find the action-item type/array in this file and add `requiresAuth?: boolean;` to it, then drop the cast:

```ts
// BEFORE
if ((action as any).requiresAuth && !user) return false;
// AFTER
if (action.requiresAuth && !user) return false;
```

- [ ] **Step 6: `CreateTrainer.tsx` — unwrap result envelope**

Line 161 reads `(result as any)?.data?.data`. Import the envelope and type the unwrap. `result` is the resolved value of the `createTrainer` mutation `.unwrap()`. Replace:

```ts
// BEFORE
const responseData = (result as any)?.data?.data;
// AFTER
const responseData = (result as ApiEnvelope<{ data?: unknown }>)?.data?.data;
```

with `import { ApiEnvelope } from "../../src/types/api";`. **If** the `createTrainer` endpoint's result generic is known/declared, prefer typing the endpoint result properly and removing the cast entirely; only use the `ApiEnvelope` cast if the endpoint is still declared with a default/loose generic.

- [ ] **Step 7: Typecheck passes**

Run: `cd frontend && npm run typecheck`
Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add "frontend/app/(auth)/Welcome.tsx" frontend/src/components/ProfileMenuModal.tsx frontend/features/trainer/TrainerSchedule.tsx frontend/src/screens/Home.tsx frontend/features/users/CreateTrainer.tsx
git commit -m "refactor(types): type frontend icon props, slot layouts, action flag"
```

---

## Tier 3 — Optional, higher-risk (do only if explicitly requested)

These genuinely *can* be typed, but each carries real risk of fighting third-party/Sequelize typings or subtly changing serialized responses. Each must be gated by `npm run typecheck && npm test` and reviewed independently.

### Task 11 (optional): `where: any` → `WhereOptions`

**Files:** `server/src/controllers/trainer.ts:849,858,890` (+ the `finalTrainerWhere` it builds, ~1075-1085), `server/src/controllers/trainerSchedule.ts:1016`.

Type these as `WhereOptions<TrainerAttributes>` / `WhereOptions` (import `WhereOptions` from `"sequelize"`). **Caveat:** the code mutates these objects dynamically (`whereClause.location = ...`, `finalTrainerWhere.experienceYears[Op.gte] = ...`). Sequelize's typed `WhereOptions` may reject in-place `[Op.*]` index mutation. If tsc fights it, the minimal-risk path is to build each sub-clause as a fully-formed object literal (no post-hoc mutation) typed to the field, rather than reverting to `any`. Only attempt if you can keep `tsc` and all 118 tests green; otherwise leave as-is and document.

### Task 12 (optional): `.toJSON() as any` → augmented attribute DTOs

**Files:** `server/src/controllers/gym.ts:17,118`, `server/src/controllers/trainer.ts:128,408,521,525,528,758,800,1149`, `server/src/controllers/recommendation.ts:160`.

These casts exist because code reads computed columns (e.g. `distanceMeters` from a `Sequelize.literal` projection) that aren't in the model's attribute type. Fix by defining a per-model augmented interface, e.g.:

```ts
// in gym.ts
import { GymAttributes } from "../types/gym"; // confirm the attributes type name/path
type GymJson = GymAttributes & { distanceMeters?: number | string };
// ...
const json = g.toJSON() as GymJson;
```

and type `gymBulkCache.data` (line 17) as `Array<GymJson & { availableTrainerCount: number; distanceKm?: number }>`. Repeat the pattern for the trainer/recommendation sites using their attribute types plus the extra projected/added fields each site reads. This is response-shape modeling — verify serialized output is byte-identical via the integration tests.

### Task 13 (optional): third-party SDK & misc

Evaluate case-by-case, only removing a cast if a precise type is truly available:
- `services/billing/adapters/StripeSdkGateway.ts` (`sub: any`, `latestInvoice: any`, `as any` on SDK fields) — type with `Stripe.Subscription` etc. where the installed SDK version exposes the field; keep targeted casts for fields the SDK omits (e.g. `pending_setup_intent`).
- `services/billing/adapters/RevenueCatHttpGateway.ts:23` `(globalThis as any).fetch` — on Node 18+ with DOM/Node fetch lib types this can become `globalThis.fetch`; verify lib config first.
- `middleware/validation.ts:1023` `(value: any)` — express-validator's custom-validator value; change to `unknown` only if it doesn't break express-validator's own signature.
- `controllers/recommendation.ts:55,62` `specialization: any` in the `Map` value type — replace with the specialization shape actually consumed.

---

## Intentionally Left As-Is (justified — do NOT change)

| Location | Why it stays |
|---|---|
| `frontend/src/lib/imageUpload.ts:68` `as any` | RN `FormData.append({ uri, name, type })` — the file-object form isn't in DOM `FormData` types; the cast is the standard React Native workaround. |
| `frontend/app/checkout.tsx:595,986` (`selectedPackage as any`, `(res: any)`) | RevenueCat purchase/customer-info types; outside the "specific type readily available" bar — see Task 13 if pursued. |
| `server/src/seeds/demoScreenshotSeed.ts` (`as any` on `.create(...)`) | Dev-only seed script; casts sidestep Sequelize `CreationAttributes` strictness for fixtures. Low value, not shipped. |
| `server/src/tests/helpers.ts:36` `as any` | Test fixture role cast; test-only. |
| `server/src/controllers/trainerPackages.ts:19` `null as any` | `setDataValue` on a virtual/derived column; Sequelize typing gap. |
| `server/src/services/billing/adapters/StripeSdkGateway.ts` (some casts) | Stripe SDK type gaps for API fields the installed version omits; casts are required until SDK types catch up. |

---

## Self-Review

**Spec coverage:** The request was "fix any unspecific types like `any` or `undefined` where there could be one specific instead." Every `: any` (82), `as any` (32), and `any[]`/`Record<string, any>`/`<any>` (12) occurrence found is accounted for: Tasks 1-10 fix the clearly-typed ones; Tasks 11-13 cover the harder-but-possible ones (optional); the appendix justifies the genuinely-required casts. `undefined` was checked and found to be entirely legitimate (Global Constraints).

**Placeholder scan:** No "TBD"/"add validation"/"handle edge cases" steps. Every code step shows the exact before/after. The few "before committing, confirm X" notes (conflict shape in Task 2, slot-layout shape in Task 10, `User` import in Task 8) are bounded verification instructions with an explicit specific default and a "do not revert to `any`" guard — not open-ended placeholders.

**Type consistency:** Helper names are stable across tasks — `getApiErrorMessage` (frontend, Tasks 1-2), `getSequelizeValidationErrors`/`getErrorMessage` (server, Tasks 3-5), `ApiEnvelope<T>` (frontend, Tasks 7 & 10). `ValidationError` consistently refers to the existing `server/src/types/common.ts` interface; the Sequelize class is imported aliased as `SequelizeValidationError`. Sequelize query types (`FindAttributeOptions`, `Order`, `WhereOptions`) are used consistently.
