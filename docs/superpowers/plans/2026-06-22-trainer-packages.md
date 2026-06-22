# Trainer Custom Packages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace flat hourly/session rates with a custom package system where trainers define up to 5 packages (name, price, session count), and `sessionRate` is auto-calculated as the lowest per-session price.

**Architecture:** New `TrainerPackage` Sequelize model with dedicated route/controller following the existing `TrainerImage` pattern. Frontend gets a new RTK Query API slice. The `hourlyRate` field is hidden from UI but retained in the database. The `sessionRate` field becomes computed server-side on every package write.

**Tech Stack:** Sequelize (sequelize-typescript), Express, RTK Query, React Native, PostgreSQL

## Global Constraints

- No migration framework — the app boots with `sync({ alter: false })`. New tables must be created via raw SQL `CREATE TABLE IF NOT EXISTS` in `databaseBootstrap.ts` or by temporarily using `sync({ alter: true })`.
- VARCHAR over pg ENUM for new columns (avoids migration issues, see `trainerImage.ts` line 46-48 comment).
- `sendSuccess`/`sendError` response helpers from `server/src/utils/response.ts`.
- Translations must be added for both EN and RO in `frontend/src/lib/i18n/translations.ts`.
- `strictSchema` validation pattern from `server/src/middleware/validation.ts`.
- RTK Query tag-based cache invalidation pattern.

---

### Task 1: Backend — TrainerPackage types, model, and DB registration

**Files:**
- Create: `server/src/types/trainerPackage.ts`
- Create: `server/src/models/trainerPackage.ts`
- Modify: `server/src/db.ts:30-49` (add to models array)
- Modify: `server/src/models/trainer.ts:160` (add HasMany association)
- Modify: `server/src/models/trainer.ts:190-198` (update `isComplete` getter)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `TrainerPackage` model class, `TrainerPackageAttributes` and `TrainerPackageCreationAttributes` types, `TrainerPackage` association on `Trainer`

- [ ] **Step 1: Create the types file**

Create `server/src/types/trainerPackage.ts`:

```typescript
export interface TrainerPackageAttributes {
  id: number;
  trainerId: number;
  name: string;
  price: number;
  sessionCount: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainerPackageCreationAttributes {
  trainerId: number;
  name: string;
  price: number;
  sessionCount: number;
  sortOrder?: number;
}
```

- [ ] **Step 2: Create the model file**

Create `server/src/models/trainerPackage.ts`:

```typescript
import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  AllowNull,
  Default,
  Validate,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { Trainer } from "./trainer";
import {
  TrainerPackageAttributes,
  TrainerPackageCreationAttributes,
} from "../types/trainerPackage";

@Table({
  tableName: "trainer_packages",
  timestamps: true,
  underscored: true,
})
export class TrainerPackage extends Model<
  TrainerPackageAttributes,
  TrainerPackageCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  id!: number;

  @ForeignKey(() => Trainer)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  trainerId!: number;

  @AllowNull(false)
  @Validate({ len: [1, 100] })
  @Column(DataType.STRING(100))
  name!: string;

  @AllowNull(false)
  @Validate({ min: 0.01 })
  @Column(DataType.DECIMAL(7, 2))
  price!: number;

  @AllowNull(false)
  @Validate({ min: 1 })
  @Column(DataType.INTEGER)
  sessionCount!: number;

  @Default(0)
  @Column(DataType.INTEGER)
  sortOrder!: number;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  @BelongsTo(() => Trainer)
  trainer!: Trainer;
}
```

- [ ] **Step 3: Register the model in db.ts**

In `server/src/db.ts`, add the import after line 6:

```typescript
import { TrainerPackage } from "./models/trainerPackage";
```

Add `TrainerPackage` to the `models` array (after `TrainerImage` at line 34):

```typescript
models: [
    User,
    Review,
    Trainer,
    TrainerImage,
    TrainerPackage,  // <-- add here
    TrainerSpecialization,
    // ... rest unchanged
```

- [ ] **Step 4: Add HasMany association to Trainer model**

In `server/src/models/trainer.ts`, add import at the top (after `TrainerImage` import at line 23):

```typescript
import { TrainerPackage } from "./trainerPackage";
```

Add association after line 160 (`@HasMany(() => TrainerImage) images!: TrainerImage[];`):

```typescript
@HasMany(() => TrainerPackage) packages!: TrainerPackage[];
```

- [ ] **Step 5: Update isComplete getter**

In `server/src/models/trainer.ts`, change the `isComplete` getter (lines 190-198) to check for packages instead of rates:

Replace:
```typescript
get isComplete(): boolean {
    return !!(
      this.bio &&
      this.experienceYears !== null &&
      (this.hourlyRate || this.sessionRate) &&
      this.locationCity &&
      this.locationState
    );
  }
```

With:
```typescript
get isComplete(): boolean {
    return !!(
      this.bio &&
      this.experienceYears !== null &&
      this.sessionRate &&
      this.locationCity &&
      this.locationState
    );
  }
```

(Now checks for `sessionRate` which is set when at least one package exists.)

- [ ] **Step 6: Verify the server starts**

Run:
```bash
cd server && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add server/src/types/trainerPackage.ts server/src/models/trainerPackage.ts server/src/db.ts server/src/models/trainer.ts
git commit -m "feat: add TrainerPackage model, types, and Trainer association"
```

---

### Task 2: Backend — TrainerPackage controller with session rate recalculation

**Files:**
- Create: `server/src/controllers/trainerPackages.ts`

**Interfaces:**
- Consumes: `TrainerPackage` model, `Trainer` model, `sendSuccess`/`sendError` from `server/src/utils/response.ts`, `AuthenticatedRequest` from `server/src/types/common.ts`
- Produces: `getTrainerPackages(req, res)`, `createTrainerPackage(req, res)`, `updateTrainerPackage(req, res)`, `deleteTrainerPackage(req, res)` — all `(AuthenticatedRequest, Response) => Promise<void>`

- [ ] **Step 1: Create the controller file**

Create `server/src/controllers/trainerPackages.ts`:

```typescript
import { Response } from "express";
import { AuthenticatedRequest } from "../types/common";
import { sendError, sendSuccess } from "../utils/response";
import { Trainer } from "../models/trainer";
import { TrainerPackage } from "../models/trainerPackage";

const MAX_PACKAGES = 5;

async function getTrainerForUser(userId: number) {
  return Trainer.findOne({ where: { userId } });
}

async function recalculateSessionRate(trainerId: number): Promise<void> {
  const packages = await TrainerPackage.findAll({ where: { trainerId } });
  const trainer = await Trainer.findByPk(trainerId);
  if (!trainer) return;

  if (packages.length === 0) {
    await trainer.update({ sessionRate: null });
    return;
  }

  const lowestPerSession = Math.min(
    ...packages.map((p) => Number(p.price) / p.sessionCount)
  );
  await trainer.update({
    sessionRate: Math.round(lowestPerSession * 100) / 100,
  });
}

export const getTrainerPackages = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const trainerId = Number(req.params.trainerId);
    if (!Number.isFinite(trainerId)) {
      sendError(res, 400, "Invalid trainer id");
      return;
    }

    const packages = await TrainerPackage.findAll({
      where: { trainerId },
      order: [
        ["sortOrder", "ASC"],
        ["createdAt", "ASC"],
      ],
    });

    sendSuccess(res, 200, "Trainer packages retrieved", packages.map((p) => p.toJSON()));
  } catch (error) {
    console.error("Get trainer packages error:", error);
    sendError(res, 500, "Failed to retrieve trainer packages");
  }
};

export const createTrainerPackage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const trainer = await getTrainerForUser(req.user!.id);
    if (!trainer) {
      sendError(res, 403, "Only trainers can create packages");
      return;
    }

    const existing = await TrainerPackage.count({ where: { trainerId: trainer.id } });
    if (existing >= MAX_PACKAGES) {
      sendError(res, 422, `You can have at most ${MAX_PACKAGES} packages.`);
      return;
    }

    const { name, price, sessionCount, sortOrder } = req.body;

    const pkg = await TrainerPackage.create({
      trainerId: trainer.id,
      name,
      price,
      sessionCount,
      sortOrder: sortOrder ?? existing,
    });

    await recalculateSessionRate(trainer.id);

    sendSuccess(res, 201, "Package created", pkg.toJSON());
  } catch (error) {
    console.error("Create trainer package error:", error);
    sendError(res, 500, "Failed to create package");
  }
};

export const updateTrainerPackage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const trainer = await getTrainerForUser(req.user!.id);
    if (!trainer) {
      sendError(res, 403, "Only trainers can update packages");
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      sendError(res, 400, "Invalid package id");
      return;
    }

    const pkg = await TrainerPackage.findByPk(id);
    if (!pkg || pkg.trainerId !== trainer.id) {
      sendError(res, 404, "Package not found");
      return;
    }

    const { name, price, sessionCount, sortOrder } = req.body;
    await pkg.update({
      ...(name !== undefined && { name }),
      ...(price !== undefined && { price }),
      ...(sessionCount !== undefined && { sessionCount }),
      ...(sortOrder !== undefined && { sortOrder }),
    });

    await recalculateSessionRate(trainer.id);

    sendSuccess(res, 200, "Package updated", pkg.toJSON());
  } catch (error) {
    console.error("Update trainer package error:", error);
    sendError(res, 500, "Failed to update package");
  }
};

export const deleteTrainerPackage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const trainer = await getTrainerForUser(req.user!.id);
    if (!trainer) {
      sendError(res, 403, "Only trainers can delete packages");
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      sendError(res, 400, "Invalid package id");
      return;
    }

    const pkg = await TrainerPackage.findByPk(id);
    if (!pkg || pkg.trainerId !== trainer.id) {
      sendError(res, 404, "Package not found");
      return;
    }

    await pkg.destroy();
    await recalculateSessionRate(trainer.id);

    sendSuccess(res, 200, "Package deleted");
  } catch (error) {
    console.error("Delete trainer package error:", error);
    sendError(res, 500, "Failed to delete package");
  }
};
```

- [ ] **Step 2: Verify types compile**

Run:
```bash
cd server && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/controllers/trainerPackages.ts
git commit -m "feat: add TrainerPackage controller with session rate recalculation"
```

---

### Task 3: Backend — Validation and route registration

**Files:**
- Modify: `server/src/middleware/validation.ts` (add package validation rules)
- Create: `server/src/routes/trainerPackages.ts`
- Modify: `server/src/routes/index.ts` (mount the new router)

**Interfaces:**
- Consumes: controller functions from Task 2, `authenticate` from `server/src/middleware/auth.ts`, `handleValidationErrors` and `strictSchema` from `server/src/middleware/validation.ts`
- Produces: `/trainer-packages` route group mounted on the main router

- [ ] **Step 1: Add validation rules in validation.ts**

In `server/src/middleware/validation.ts`, add after `updateTrainerValidation` (after line 369):

```typescript
export const createTrainerPackageValidation = [
  body("name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be between 1 and 100 characters."),
  body("price")
    .isFloat({ min: 0.01, max: 99999.99 })
    .withMessage("Price must be between 0.01 and 99999.99."),
  body("sessionCount")
    .isInt({ min: 1 })
    .withMessage("Session count must be at least 1."),
  body("sortOrder")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Sort order must be a non-negative integer."),
  strictSchema({
    body: ["name", "price", "sessionCount", "sortOrder"],
  }),
];

export const updateTrainerPackageValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be between 1 and 100 characters."),
  body("price")
    .optional()
    .isFloat({ min: 0.01, max: 99999.99 })
    .withMessage("Price must be between 0.01 and 99999.99."),
  body("sessionCount")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Session count must be at least 1."),
  body("sortOrder")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Sort order must be a non-negative integer."),
  strictSchema({
    body: ["name", "price", "sessionCount", "sortOrder"],
  }),
];
```

- [ ] **Step 2: Create the route file**

Create `server/src/routes/trainerPackages.ts`:

```typescript
import Express from "express";
import { authenticate } from "../middleware/auth";
import {
  getTrainerPackages,
  createTrainerPackage,
  updateTrainerPackage,
  deleteTrainerPackage,
} from "../controllers/trainerPackages";
import {
  createTrainerPackageValidation,
  updateTrainerPackageValidation,
  handleValidationErrors,
} from "../middleware/validation";

const router = Express.Router();

router.get("/:trainerId", getTrainerPackages);

router.use(authenticate);

router.post(
  "/",
  createTrainerPackageValidation,
  handleValidationErrors,
  createTrainerPackage
);
router.put(
  "/:id",
  updateTrainerPackageValidation,
  handleValidationErrors,
  updateTrainerPackage
);
router.delete("/:id", deleteTrainerPackage);

export default router;
```

- [ ] **Step 3: Mount the route in routes/index.ts**

In `server/src/routes/index.ts`, add the import (after `trainerImagesRouter` import at line 7):

```typescript
import trainerPackagesRouter from "./trainerPackages";
```

Add the route mount (after line 33, the `trainer-images` mount):

```typescript
router.use("/trainer-packages", trainerPackagesRouter);
```

- [ ] **Step 4: Verify types compile**

Run:
```bash
cd server && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add server/src/middleware/validation.ts server/src/routes/trainerPackages.ts server/src/routes/index.ts
git commit -m "feat: add TrainerPackage routes and validation"
```

---

### Task 4: Frontend — RTK Query API slice for trainer packages

**Files:**
- Create: `frontend/features/trainer/trainerPackageApiSlice.ts`
- Modify: `frontend/src/api/apiSlice.ts:106-117` (add tag type)

**Interfaces:**
- Consumes: `apiSlice` from `frontend/src/api/apiSlice.ts`
- Produces: `useGetTrainerPackagesQuery(trainerId: number)`, `useCreateTrainerPackageMutation()`, `useUpdateTrainerPackageMutation()`, `useDeleteTrainerPackageMutation()`; `TrainerPackageItem` interface

- [ ] **Step 1: Add tag type to apiSlice**

In `frontend/src/api/apiSlice.ts`, add `"TrainerPackages"` to the `tagTypes` array (line 106-117):

```typescript
tagTypes: [
    "Gyms",
    "MyGyms",
    "TrainerSlots",
    "MySchedule",
    "PendingClientCodes",
    "Reviews",
    "BlockedDates",
    "ClientPreferences",
    "SuggestedTrainers",
    "TrainerImages",
    "TrainerPackages",
  ],
```

- [ ] **Step 2: Create the API slice file**

Create `frontend/features/trainer/trainerPackageApiSlice.ts`:

```typescript
import { apiSlice } from "../../src/api/apiSlice";

export interface TrainerPackageItem {
  id: number;
  trainerId: number;
  name: string;
  price: number;
  sessionCount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface TrainerPackagesResponse {
  success: boolean;
  message: string;
  data: TrainerPackageItem[];
}

interface TrainerPackageMutationResponse {
  success: boolean;
  message: string;
  data: TrainerPackageItem;
}

interface CreateTrainerPackageRequest {
  name: string;
  price: number;
  sessionCount: number;
  sortOrder?: number;
}

interface UpdateTrainerPackageRequest {
  id: number;
  name?: string;
  price?: number;
  sessionCount?: number;
  sortOrder?: number;
}

export const trainerPackageApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTrainerPackages: builder.query<TrainerPackagesResponse, number>({
      query: (trainerId) => `/trainer-packages/${trainerId}`,
      providesTags: ["TrainerPackages"],
    }),

    createTrainerPackage: builder.mutation<
      TrainerPackageMutationResponse,
      CreateTrainerPackageRequest
    >({
      query: (body) => ({
        url: "/trainer-packages",
        method: "POST",
        body,
      }),
      invalidatesTags: ["TrainerPackages"],
    }),

    updateTrainerPackage: builder.mutation<
      TrainerPackageMutationResponse,
      UpdateTrainerPackageRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/trainer-packages/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["TrainerPackages"],
    }),

    deleteTrainerPackage: builder.mutation<
      { success: boolean; message: string },
      number
    >({
      query: (id) => ({
        url: `/trainer-packages/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["TrainerPackages"],
    }),
  }),
});

export const {
  useGetTrainerPackagesQuery,
  useCreateTrainerPackageMutation,
  useUpdateTrainerPackageMutation,
  useDeleteTrainerPackageMutation,
} = trainerPackageApiSlice;
```

- [ ] **Step 3: Verify frontend types compile**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/features/trainer/trainerPackageApiSlice.ts frontend/src/api/apiSlice.ts
git commit -m "feat: add TrainerPackage RTK Query API slice"
```

---

### Task 5: Frontend — i18n translations for packages

**Files:**
- Modify: `frontend/src/lib/i18n/translations.ts` (add EN and RO package keys)

**Interfaces:**
- Consumes: nothing
- Produces: Translation keys: `myPackages`, `addPackage`, `packageName`, `packagePrice`, `sessionCount`, `perSessionRate`, `fromPerSession`, `maxPackagesReached`, `packageNameRequired`, `packagePriceRequired`, `sessionCountRequired`, `deletePackageConfirm`, `deletePackageTitle`, `packageCreated`, `packageUpdated`, `packageDeleted`, `noPackages`, `noPackagesHint`, `sessions`

- [ ] **Step 1: Add English translation keys**

In the `en` object in `frontend/src/lib/i18n/translations.ts`, add near the existing pricing keys (around line 442-446, after `sessionRate`):

```typescript
  myPackages: "My Packages",
  addPackage: "Add Package",
  packageName: "Package Name",
  packagePrice: "Price ($)",
  sessionCount: "Sessions",
  perSessionRate: "Per Session",
  fromPerSession: "From $%s/session",
  maxPackagesReached: "Maximum of 5 packages reached.",
  packageNameRequired: "Package name is required.",
  packagePriceRequired: "Price must be greater than 0.",
  sessionCountRequired: "Session count must be at least 1.",
  deletePackageConfirm: "Are you sure you want to delete this package?",
  deletePackageTitle: "Delete Package",
  packageCreated: "Package created successfully.",
  packageUpdated: "Package updated successfully.",
  packageDeleted: "Package deleted successfully.",
  noPackages: "No packages yet",
  noPackagesHint: "Add your first package to show clients your pricing.",
  sessions: "sessions",
```

- [ ] **Step 2: Add Romanian translation keys**

In the `ro` object, add the corresponding keys (near the equivalent section, around line 1090-1094):

```typescript
  myPackages: "Pachetele Mele",
  addPackage: "Adaugă Pachet",
  packageName: "Numele Pachetului",
  packagePrice: "Preț (lei)",
  sessionCount: "Ședințe",
  perSessionRate: "Per Ședință",
  fromPerSession: "De la $%s/ședință",
  maxPackagesReached: "Maxim 5 pachete.",
  packageNameRequired: "Numele pachetului este obligatoriu.",
  packagePriceRequired: "Prețul trebuie să fie mai mare decât 0.",
  sessionCountRequired: "Numărul de ședințe trebuie să fie cel puțin 1.",
  deletePackageConfirm: "Sigur doriți să ștergeți acest pachet?",
  deletePackageTitle: "Șterge Pachet",
  packageCreated: "Pachet creat cu succes.",
  packageUpdated: "Pachet actualizat cu succes.",
  packageDeleted: "Pachet șters cu succes.",
  noPackages: "Niciun pachet încă",
  noPackagesHint: "Adăugați primul pachet pentru a arăta clienților prețurile.",
  sessions: "ședințe",
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/i18n/translations.ts
git commit -m "feat: add EN and RO translations for trainer packages"
```

---

### Task 6: Frontend — Hide hourlyRate from TrainerProfile

**Files:**
- Modify: `frontend/features/trainer/TrainerProfile.tsx:364-388` (remove hourlyRate from view/edit)
- Modify: `frontend/features/trainer/TrainerProfile.tsx:137-188` (remove hourlyRate from save payload)
- Modify: `frontend/features/trainer/hooks/useTrainerFormState.ts` (remove hourlyRate field)
- Modify: `frontend/features/trainer/trainerApiSlice.ts:15-29` (remove hourlyRate from TrainerUpdateRequest)

**Interfaces:**
- Consumes: existing TrainerProfile code
- Produces: TrainerProfile without hourlyRate in view, edit, or save paths

- [ ] **Step 1: Remove hourlyRate from TrainerUpdateRequest**

In `frontend/features/trainer/trainerApiSlice.ts`, remove `hourlyRate?: number;` from the `TrainerUpdateRequest` interface (line 18). The interface should become:

```typescript
interface TrainerUpdateRequest {
  bio?: string;
  experienceYears?: number;
  sessionRate?: number;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  latitude?: number;
  longitude?: number;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  whatsappUrl?: string | null;
  specializationIds?: number[];
}
```

- [ ] **Step 2: Remove hourlyRate from useTrainerFormState hook**

In `frontend/features/trainer/hooks/useTrainerFormState.ts`:

Remove from `TrainerFormFields` interface (line 6): `hourlyRate: string;`
Remove from `TrainerFormSetters` interface (line 20): `setHourlyRate: (v: string) => void;`
Remove from `TrainerLike` interface (line 34): `hourlyRate?: number | null;`
Remove from `hydrateFromTrainer` function (lines 58-59): the `hourlyRate` assignment.
Remove the `useState` for `hourlyRate` (line 80): `const [hourlyRate, setHourlyRate] = useState("");`
Remove `setHourlyRate` from the `useEffect` (line 96) and `resetToTrainer` (line 116).
Remove from the return object (lines 130): `hourlyRate, setHourlyRate,`

- [ ] **Step 3: Remove hourlyRate from TrainerProfile view and edit**

In `frontend/features/trainer/TrainerProfile.tsx`:

In the edit section (around line 370), remove the hourlyRate TextInput:
```typescript
<TextInput style={styles.input} keyboardType="decimal-pad" value={form.hourlyRate} onChangeText={form.setHourlyRate} placeholder={t("hourlyRatePlaceholder")} />
```

In the view section (around lines 379-382), remove the hourlyRate info card:
```typescript
<View style={styles.infoCard}>
  <Text style={styles.infoLabel}>{t("hourlyRate")}</Text>
  <Text style={styles.infoValue}>${trainer.hourlyRate || 0}{t("perHour")}</Text>
</View>
```

Make sessionRate read-only in edit mode — replace the sessionRate TextInput with a display-only view:
```typescript
<View style={styles.infoCard}>
  <Text style={styles.infoLabel}>{t("sessionRate")}</Text>
  <Text style={styles.infoValue}>${trainer.sessionRate || "—"}{trainer.sessionRate ? t("perSession") : ""}</Text>
</View>
```

- [ ] **Step 4: Remove hourlyRate from save payload**

In `frontend/features/trainer/TrainerProfile.tsx`, in `handleSaveProfile` (around line 141):

Remove: `const parsedHourly = form.hourlyRate.trim() === "" ? undefined : Number(form.hourlyRate);`

In the `updateTrainerProfile` call (around line 172), remove: `hourlyRate: parsedHourly,`

Also remove `sessionRate: parsedSession,` from the payload since it's now auto-calculated server-side.

And remove `const parsedSession = form.sessionRate.trim() === "" ? undefined : Number(form.sessionRate);` (line 142).

- [ ] **Step 5: Verify frontend types compile**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/features/trainer/TrainerProfile.tsx frontend/features/trainer/hooks/useTrainerFormState.ts frontend/features/trainer/trainerApiSlice.ts
git commit -m "feat: hide hourlyRate from TrainerProfile, make sessionRate read-only"
```

---

### Task 7: Frontend — Hide hourlyRate from CreateTrainer and add package creation

**Files:**
- Modify: `frontend/features/users/CreateTrainer.tsx`

**Interfaces:**
- Consumes: `useCreateTrainerPackageMutation` from Task 4
- Produces: CreateTrainer form with inline package creation instead of hourly/session rate fields

- [ ] **Step 1: Replace rate state with package state**

In `frontend/features/users/CreateTrainer.tsx`:

Remove lines 32-33:
```typescript
const [hourlyRate, setHourlyRate] = useState("");
const [sessionRate, setSessionRate] = useState("");
```

Add in their place:
```typescript
const [packages, setPackages] = useState<Array<{ name: string; price: string; sessionCount: string }>>([
  { name: "", price: "", sessionCount: "" },
]);
```

Add import for the mutation:
```typescript
import { useCreateTrainerPackageMutation } from "../trainer/trainerPackageApiSlice";
```

Add the hook after `useCreateTrainerMutation`:
```typescript
const [createPackage] = useCreateTrainerPackageMutation();
```

Add package helper functions after `toggleSpecialization`:
```typescript
const addPackageRow = useCallback(() => {
  if (packages.length >= 5) return;
  setPackages((prev) => [...prev, { name: "", price: "", sessionCount: "" }]);
}, [packages.length]);

const removePackageRow = useCallback((index: number) => {
  setPackages((prev) => prev.filter((_, i) => i !== index));
}, []);

const updatePackageField = useCallback(
  (index: number, field: "name" | "price" | "sessionCount", value: string) => {
    setPackages((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  },
  []
);
```

- [ ] **Step 2: Update validation**

Replace the hourlyRate/sessionRate validation in `validateForm` (lines 70-77, 107-115) with:

```typescript
if (packages.length === 0) {
  setErrMsg(t("packageNameRequired"));
  return false;
}
for (const pkg of packages) {
  if (!pkg.name.trim()) {
    setErrMsg(t("packageNameRequired"));
    return false;
  }
  if (!pkg.price.trim() || isNaN(parseFloat(pkg.price)) || parseFloat(pkg.price) <= 0) {
    setErrMsg(t("packagePriceRequired"));
    return false;
  }
  if (!pkg.sessionCount.trim() || isNaN(parseInt(pkg.sessionCount)) || parseInt(pkg.sessionCount) < 1) {
    setErrMsg(t("sessionCountRequired"));
    return false;
  }
}
```

- [ ] **Step 3: Update handleSubmit**

In `handleSubmit`, remove `hourlyRate` and `sessionRate` from `trainerData` (lines 132-133).

After the trainer is created successfully (after `dispatch(requestTrainerTour())` at line 147), add package creation:

```typescript
if (responseData) {
  for (const pkg of packages) {
    await createPackage({
      name: pkg.name.trim(),
      price: parseFloat(pkg.price),
      sessionCount: parseInt(pkg.sessionCount),
    });
  }
}
```

Update the `useCallback` dependency array to include `packages` and `createPackage` instead of `hourlyRate` and `sessionRate`.

- [ ] **Step 4: Replace the pricing section in the JSX**

Replace the Pricing Section (lines 342-372) with:

```typescript
{/* Pricing Packages Section */}
<View style={styles.section}>
  <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
    <Ionicons name="cash-outline" size={20} color={theme.colors.primary} style={{marginRight: 6}} />
    <Text style={[styles.sectionTitle, {marginBottom: 0}]}>{t("myPackages")}</Text>
  </View>

  {packages.map((pkg, index) => (
    <View key={index} style={{marginBottom: 16, padding: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border}}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
        <Text style={{fontSize: 14, fontWeight: '600', color: theme.colors.text}}>
          {t("addPackage")} {index + 1}
        </Text>
        {packages.length > 1 && (
          <Pressable onPress={() => removePackageRow(index)}>
            <Ionicons name="trash-outline" size={20} color="#DC2626" />
          </Pressable>
        )}
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t("packageName")}</Text>
        <TextInput
          style={styles.input}
          value={pkg.name}
          placeholder="e.g. Starter Pack"
          onChangeText={(v) => updatePackageField(index, "name", v)}
        />
      </View>
      <View style={styles.row}>
        <View style={[styles.inputGroup, styles.halfWidth]}>
          <Text style={styles.label}>{t("packagePrice")}</Text>
          <TextInput
            style={styles.input}
            value={pkg.price}
            placeholder="120"
            onChangeText={(v) => updatePackageField(index, "price", v)}
            keyboardType="numeric"
          />
        </View>
        <View style={[styles.inputGroup, styles.halfWidth]}>
          <Text style={styles.label}>{t("sessionCount")}</Text>
          <TextInput
            style={styles.input}
            value={pkg.sessionCount}
            placeholder="4"
            onChangeText={(v) => updatePackageField(index, "sessionCount", v)}
            keyboardType="number-pad"
          />
        </View>
      </View>
    </View>
  ))}

  {packages.length < 5 && (
    <Pressable
      onPress={addPackageRow}
      style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.primary, borderStyle: 'dashed'}}
    >
      <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} style={{marginRight: 6}} />
      <Text style={{color: theme.colors.primary, fontWeight: '600'}}>{t("addPackage")}</Text>
    </Pressable>
  )}
</View>
```

- [ ] **Step 5: Verify frontend types compile**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/features/users/CreateTrainer.tsx
git commit -m "feat: replace hourly/session rate inputs with package creation in CreateTrainer"
```

---

### Task 8: Frontend — Add packages section to TrainerProfile (edit + view)

**Files:**
- Modify: `frontend/features/trainer/TrainerProfile.tsx`

**Interfaces:**
- Consumes: `useGetTrainerPackagesQuery`, `useCreateTrainerPackageMutation`, `useUpdateTrainerPackageMutation`, `useDeleteTrainerPackageMutation` from Task 4, `TrainerPackageItem` type
- Produces: Packages section in TrainerProfile with CRUD

- [ ] **Step 1: Add imports and hooks**

In `frontend/features/trainer/TrainerProfile.tsx`, add imports at the top:

```typescript
import {
  useGetTrainerPackagesQuery,
  useCreateTrainerPackageMutation,
  useUpdateTrainerPackageMutation,
  useDeleteTrainerPackageMutation,
  TrainerPackageItem,
} from "./trainerPackageApiSlice";
```

In the component body (after the existing hook calls), add:

```typescript
const { data: packagesResponse } = useGetTrainerPackagesQuery(trainer?.id ?? 0, { skip: !trainer?.id });
const trainerPackages = packagesResponse?.data ?? [];
const [createPackage] = useCreateTrainerPackageMutation();
const [updatePackage] = useUpdateTrainerPackageMutation();
const [deletePackage] = useDeleteTrainerPackageMutation();

const [editingPackages, setEditingPackages] = useState<Array<{ id?: number; name: string; price: string; sessionCount: string }>>([]);

useEffect(() => {
  if (trainerPackages.length > 0) {
    setEditingPackages(trainerPackages.map((p) => ({
      id: p.id,
      name: p.name,
      price: String(p.price),
      sessionCount: String(p.sessionCount),
    })));
  }
}, [trainerPackages]);
```

Add state import if not already present: `useState` should already be imported.

- [ ] **Step 2: Add package helper functions**

Add after the existing helper functions:

```typescript
const addEditPackageRow = useCallback(() => {
  if (editingPackages.length >= 5) return;
  setEditingPackages((prev) => [...prev, { name: "", price: "", sessionCount: "" }]);
}, [editingPackages.length]);

const removeEditPackageRow = useCallback((index: number) => {
  setEditingPackages((prev) => prev.filter((_, i) => i !== index));
}, []);

const updateEditPackageField = useCallback(
  (index: number, field: "name" | "price" | "sessionCount", value: string) => {
    setEditingPackages((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  },
  []
);

const handleSavePackages = useCallback(async () => {
  if (!trainer) return;

  try {
    const existingIds = new Set(editingPackages.filter((p) => p.id).map((p) => p.id!));
    const deletedPackages = trainerPackages.filter((p) => !existingIds.has(p.id));
    for (const pkg of deletedPackages) {
      await deletePackage(pkg.id);
    }

    for (let i = 0; i < editingPackages.length; i++) {
      const pkg = editingPackages[i];
      const price = parseFloat(pkg.price);
      const sessionCount = parseInt(pkg.sessionCount);

      if (!pkg.name.trim() || isNaN(price) || price <= 0 || isNaN(sessionCount) || sessionCount < 1) {
        Alert.alert(t("invalidInput"), t("packagePriceRequired"));
        return;
      }

      if (pkg.id) {
        await updatePackage({ id: pkg.id, name: pkg.name.trim(), price, sessionCount, sortOrder: i });
      } else {
        await createPackage({ name: pkg.name.trim(), price, sessionCount, sortOrder: i });
      }
    }

    Alert.alert(t("success"), t("packageUpdated"));
  } catch (error: any) {
    Alert.alert(t("error"), error?.data?.message || t("updateError"));
  }
}, [trainer, editingPackages, trainerPackages, createPackage, updatePackage, deletePackage, t]);
```

- [ ] **Step 3: Add packages section to JSX**

In the JSX, after the "Experience & Rates" section (after line 389), add a new packages section:

```typescript
{/* ── Packages ── */}
<View style={styles.section}>
  <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 15}}>
    <Ionicons name="pricetags-outline" size={18} color={theme.colors.primary} style={{marginRight: 6}} />
    <Text style={[styles.sectionTitle, {marginBottom: 0}]}>{t("myPackages")}</Text>
  </View>
  {isEditing ? (
    <View>
      {editingPackages.map((pkg, index) => (
        <View key={pkg.id ?? `new-${index}`} style={{marginBottom: 12, padding: 14, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border}}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
            <Text style={{fontSize: 13, fontWeight: '600', color: theme.colors.text}}>
              {t("addPackage")} {index + 1}
            </Text>
            {editingPackages.length > 0 && (
              <Pressable onPress={() => removeEditPackageRow(index)}>
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
              </Pressable>
            )}
          </View>
          <TextInput style={styles.input} value={pkg.name} onChangeText={(v) => updateEditPackageField(index, "name", v)} placeholder={t("packageName")} />
          <View style={{flexDirection: 'row', gap: 10, marginTop: 8}}>
            <TextInput style={[styles.input, {flex: 1}]} value={pkg.price} onChangeText={(v) => updateEditPackageField(index, "price", v)} placeholder={t("packagePrice")} keyboardType="numeric" />
            <TextInput style={[styles.input, {flex: 1}]} value={pkg.sessionCount} onChangeText={(v) => updateEditPackageField(index, "sessionCount", v)} placeholder={t("sessionCount")} keyboardType="number-pad" />
          </View>
        </View>
      ))}
      {editingPackages.length < 5 && (
        <Pressable onPress={addEditPackageRow} style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.primary, borderStyle: 'dashed', marginTop: 4}}>
          <Ionicons name="add-circle-outline" size={18} color={theme.colors.primary} style={{marginRight: 6}} />
          <Text style={{color: theme.colors.primary, fontWeight: '600', fontSize: 14}}>{t("addPackage")}</Text>
        </Pressable>
      )}
      <Pressable
        style={({pressed}) => [{marginTop: 14, backgroundColor: theme.colors.primary, padding: 14, borderRadius: 12, alignItems: 'center'}, pressed && {opacity: 0.8}]}
        onPress={() => { void handleSavePackages(); }}
      >
        <Text style={{color: '#fff', fontWeight: '600'}}>{t("saveChanges")}</Text>
      </Pressable>
    </View>
  ) : trainerPackages.length > 0 ? (
    <View>
      {trainerPackages.map((pkg) => (
        <View key={pkg.id} style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6'}}>
          <View>
            <Text style={{fontSize: 15, fontWeight: '600', color: theme.colors.text}}>{pkg.name}</Text>
            <Text style={{fontSize: 13, color: theme.colors.textSecondary, marginTop: 2}}>
              {pkg.sessionCount} {t("sessions")} — ${(Number(pkg.price) / pkg.sessionCount).toFixed(2)}{t("perSession")}
            </Text>
          </View>
          <Text style={{fontSize: 16, fontWeight: '700', color: theme.colors.primary}}>${Number(pkg.price).toFixed(2)}</Text>
        </View>
      ))}
    </View>
  ) : (
    <Text style={{color: theme.colors.textSecondary, fontSize: 14}}>{t("noPackages")}</Text>
  )}
</View>
```

- [ ] **Step 4: Update the "Experience & Rates" section title**

Change the section title from `t("experienceAndRates")` to `t("experience")` in both edit and view modes (line 366), since rates are now in the packages section. The section should only show experience years.

Remove the `sessionRate` display/edit from this section since it's now auto-calculated and shown in the packages section header or as a read-only summary.

- [ ] **Step 5: Verify frontend types compile**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/features/trainer/TrainerProfile.tsx
git commit -m "feat: add packages section to TrainerProfile with CRUD"
```

---

### Task 9: Frontend — Update trainer detail page and search display

**Files:**
- Modify: `frontend/app/trainers/[id].tsx:435-449` (replace rates with packages)

**Interfaces:**
- Consumes: `useGetTrainerPackagesQuery` from Task 4
- Produces: Trainer detail page showing packages instead of flat rates

- [ ] **Step 1: Add packages query to trainer detail page**

In `frontend/app/trainers/[id].tsx`, add import:

```typescript
import { useGetTrainerPackagesQuery } from "../../features/trainer/trainerPackageApiSlice";
```

In the component body, add the query (use the trainer id from route params):

```typescript
const { data: packagesResponse } = useGetTrainerPackagesQuery(trainer?.id ?? 0, { skip: !trainer?.id });
const trainerPackages = packagesResponse?.data ?? [];
```

- [ ] **Step 2: Replace the pricing section**

Replace the "Experience & Rates" section (lines 435-449) that shows `hourlyRate` and `sessionRate` with:

```typescript
<View style={styles.section}>
  <Text style={styles.sectionTitle}>{t("experienceAndRates")}</Text>
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{t("experience")}</Text>
    <Text style={styles.infoValue}>{experienceYears} {t("years")}</Text>
  </View>
  {sessionRate && (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{t("sessionRate")}</Text>
      <Text style={styles.infoValue}>{t("fromPerSession").replace("%s", String(sessionRate))}</Text>
    </View>
  )}
</View>

{trainerPackages.length > 0 && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{t("myPackages")}</Text>
    {trainerPackages.map((pkg) => (
      <View key={pkg.id} style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6'}}>
        <View>
          <Text style={{fontSize: 15, fontWeight: '600', color: theme.colors.text}}>{pkg.name}</Text>
          <Text style={{fontSize: 13, color: theme.colors.textSecondary, marginTop: 2}}>
            {pkg.sessionCount} {t("sessions")}
          </Text>
        </View>
        <Text style={{fontSize: 16, fontWeight: '700', color: theme.colors.primary}}>${Number(pkg.price).toFixed(2)}</Text>
      </View>
    ))}
  </View>
)}
```

- [ ] **Step 3: Verify frontend types compile**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/trainers/[id].tsx
git commit -m "feat: show packages on trainer detail page, hide hourlyRate"
```

---

### Task 10: Database bootstrap — Create trainer_packages table

**Files:**
- Modify: `server/src/services/databaseBootstrap.ts` (add CREATE TABLE IF NOT EXISTS for trainer_packages)

**Interfaces:**
- Consumes: Sequelize connection from `server/src/db.ts`
- Produces: `trainer_packages` table created on server startup if it doesn't exist

- [ ] **Step 1: Check current bootstrap file**

Read `server/src/services/databaseBootstrap.ts` to see how existing tables are bootstrapped.

- [ ] **Step 2: Add trainer_packages table creation**

Add a raw SQL query to create the table:

```typescript
await sequelize.query(`
  CREATE TABLE IF NOT EXISTS trainer_packages (
    id SERIAL PRIMARY KEY,
    trainer_id INTEGER NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(7,2) NOT NULL CHECK (price > 0),
    session_count INTEGER NOT NULL CHECK (session_count >= 1),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`);
```

- [ ] **Step 3: Verify the server starts**

Run:
```bash
cd server && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/databaseBootstrap.ts
git commit -m "feat: add trainer_packages table bootstrap SQL"
```
