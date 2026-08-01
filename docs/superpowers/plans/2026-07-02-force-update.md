# Force Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Force users below a configured minimum app version onto a non-dismissible "Update Required" wall that deep-links to the App Store / Google Play, with the minimum version + message controlled from a database row (no redeploy).

**Architecture:** On launch the app sends its version + platform to a public backend endpoint. The backend compares against a `app_min_version` DB row (one per platform) and replies `{ updateRequired, message, storeUrl }`. If `updateRequired`, the app renders a blocking wall instead of the navigator. The check fails **open**: any network/parse error boots the app normally so a backend outage never locks out users.

**Tech Stack:** Backend — Express + sequelize-typescript + Postgres + Jest. Frontend — React Native (Expo), expo-router, `expo-constants` (already installed), React Native `Linking`, existing i18n.

## Global Constraints

- No new dependencies on either side. `expo-constants` and `Linking` already exist; backend uses existing sequelize/express/jest.
- Fail-open everywhere: loading, network error, unknown platform, missing row, or malformed version → `updateRequired: false` / app boots normally.
- Endpoint is **public** (no `authenticate` middleware) — it must work before login.
- iOS store URL seed: `https://apps.apple.com/app/id6775085258` (Apple app id `6775085258`, permanent).
- Android store URL seed: `https://play.google.com/store/apps/details?id=com.juroctech.frontend`.
- Both platforms seed `min_version` = `1.0.0` (current shipped version — nobody blocked until you bump it).
- Backend response envelope uses existing `sendSuccess(res, 200, msg, data)` from `src/utils/response.ts`.
- Follow existing layering: `models/` (decorator model) → `types/` (attributes interfaces) → `controllers/` → `routes/` → mounted in `routes/index.ts`.

---

### Task 1: Version comparison utility

Pure function, no I/O — the only non-trivial logic on the backend. Testable in isolation with Jest.

**Files:**
- Create: `server/src/utils/versionCompare.ts`
- Test: `server/src/tests/versionCompare.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isUpdateRequired(current: string, minimum: string): boolean` — returns `true` when `current` is strictly older than `minimum`. Malformed input returns `false` (fail-open).

- [ ] **Step 1: Write the failing test**

```ts
// server/src/tests/versionCompare.test.ts
import { isUpdateRequired } from "../utils/versionCompare";

describe("isUpdateRequired", () => {
  it("older current version → true", () => {
    expect(isUpdateRequired("1.0.0", "1.2.0")).toBe(true);
    expect(isUpdateRequired("1.2.9", "1.3.0")).toBe(true);
  });

  it("equal version → false", () => {
    expect(isUpdateRequired("1.2.0", "1.2.0")).toBe(false);
  });

  it("newer current version → false", () => {
    expect(isUpdateRequired("2.0.0", "1.9.9")).toBe(false);
  });

  it("differing segment lengths compare by value", () => {
    expect(isUpdateRequired("1.2", "1.2.0")).toBe(false); // 1.2 == 1.2.0
    expect(isUpdateRequired("1.2", "1.2.1")).toBe(true);
    expect(isUpdateRequired("1.2.0.0", "1.2")).toBe(false);
  });

  it("malformed input → false (fail-open)", () => {
    expect(isUpdateRequired("", "1.2.0")).toBe(false);
    expect(isUpdateRequired("abc", "1.2.0")).toBe(false);
    expect(isUpdateRequired("1.2.0", "")).toBe(false);
    expect(isUpdateRequired(undefined as unknown as string, "1.0.0")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/tests/versionCompare.test.ts`
Expected: FAIL — `Cannot find module '../utils/versionCompare'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// server/src/utils/versionCompare.ts

// Parse a dotted version into numeric segments. Returns null if any segment
// is missing or non-numeric so callers can fail open on malformed input.
const parse = (value: string): number[] | null => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const segments = value.trim().split(".");
  const nums: number[] = [];
  for (const seg of segments) {
    if (!/^\d+$/.test(seg)) return null;
    nums.push(Number(seg));
  }
  return nums;
};

/**
 * True when `current` is strictly older than `minimum`.
 * Missing trailing segments are treated as 0 (1.2 == 1.2.0).
 * Any malformed input returns false (fail-open — never block on bad data).
 */
export const isUpdateRequired = (current: string, minimum: string): boolean => {
  const cur = parse(current);
  const min = parse(minimum);
  if (!cur || !min) return false;

  const len = Math.max(cur.length, min.length);
  for (let i = 0; i < len; i++) {
    const c = cur[i] ?? 0;
    const m = min[i] ?? 0;
    if (c < m) return true;
    if (c > m) return false;
  }
  return false; // equal
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest src/tests/versionCompare.test.ts`
Expected: PASS — all cases green.

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/versionCompare.ts server/src/tests/versionCompare.test.ts
git commit -m "feat(server): version comparison util for force-update"
```

---

### Task 2: `AppMinVersion` model + types + registration

Persists one row per platform. No unit test — exercised through Task 4's endpoint.

**Files:**
- Create: `server/src/types/appMinVersion.ts`
- Create: `server/src/models/appMinVersion.ts`
- Modify: `server/src/db.ts` (import + add to `models: [...]` array)

**Interfaces:**
- Consumes: nothing.
- Produces: `AppMinVersion` model with columns `platform` (string PK), `minVersion` (string), `storeUrl` (string), `message` (text), `updatedAt`. Table name `app_min_version`, `underscored: true` (so columns are `min_version`, `store_url`, `updated_at`).

- [ ] **Step 1: Create the types file**

```ts
// server/src/types/appMinVersion.ts
export interface AppMinVersionAttributes {
  platform: string; // 'ios' | 'android'
  minVersion: string;
  storeUrl: string;
  message: string;
  updatedAt: Date;
}

export interface AppMinVersionCreationAttributes {
  platform: string;
  minVersion: string;
  storeUrl: string;
  message: string;
}
```

- [ ] **Step 2: Create the model**

```ts
// server/src/models/appMinVersion.ts
import {
  Table,
  Column,
  Model,
  DataType,
  AllowNull,
  UpdatedAt,
} from "sequelize-typescript";
import {
  AppMinVersionAttributes,
  AppMinVersionCreationAttributes,
} from "../types/appMinVersion";

@Table({
  tableName: "app_min_version",
  timestamps: true,
  underscored: true,
  createdAt: false,
})
export class AppMinVersion extends Model<
  AppMinVersionAttributes,
  AppMinVersionCreationAttributes
> {
  @Column({
    type: DataType.STRING(20),
    primaryKey: true,
  })
  platform!: string;

  @AllowNull(false)
  @Column(DataType.STRING(20))
  minVersion!: string;

  @AllowNull(false)
  @Column(DataType.STRING(500))
  storeUrl!: string;

  @AllowNull(false)
  @Default("")
  @Column(DataType.TEXT)
  message!: string;

  @UpdatedAt
  updatedAt!: Date;
}
```

> Note: add `Default` to the import list from `sequelize-typescript` (used on `message`).

- [ ] **Step 3: Register the model in `db.ts`**

Add the import near the other model imports (top of `server/src/db.ts`):

```ts
import { AppMinVersion } from "./models/appMinVersion";
```

Add `AppMinVersion` to the `models: [...]` array (after `ClientPreference`):

```ts
    ClientPreference,
    AppMinVersion,
  ],
```

- [ ] **Step 4: Verify it compiles and syncs**

Run: `cd server && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add server/src/models/appMinVersion.ts server/src/types/appMinVersion.ts server/src/db.ts
git commit -m "feat(server): AppMinVersion model for force-update config"
```

---

### Task 3: Seed the two platform rows on startup

Idempotent seed (upsert-by-PK style: create only if missing) so existing rows are never clobbered — you edit them by SQL, not by redeploy.

**Files:**
- Create: `server/src/seeds/appMinVersionSeed.ts`
- Modify: `server/src/index.ts` (import + call after `seedSpecializations()`)

**Interfaces:**
- Consumes: `AppMinVersion` model (Task 2).
- Produces: `seedAppMinVersion(): Promise<void>`.

- [ ] **Step 1: Create the seed**

```ts
// server/src/seeds/appMinVersionSeed.ts
import { AppMinVersion } from "../models/appMinVersion";

const DEFAULT_MESSAGE =
  "A new version of the app is available. Please update to continue.";

export const seedAppMinVersion = async (): Promise<void> => {
  try {
    const rows = [
      {
        platform: "ios",
        minVersion: "1.0.0",
        storeUrl: "https://apps.apple.com/app/id6775085258",
        message: DEFAULT_MESSAGE,
      },
      {
        platform: "android",
        minVersion: "1.0.0",
        storeUrl:
          "https://play.google.com/store/apps/details?id=com.juroctech.frontend",
        message: DEFAULT_MESSAGE,
      },
    ];

    for (const row of rows) {
      // findOrCreate: never overwrite a row an operator has edited via SQL.
      await AppMinVersion.findOrCreate({
        where: { platform: row.platform },
        defaults: row,
      });
    }

    console.log("✅ App min-version rows ensured.");
  } catch (error) {
    console.error("Error seeding app_min_version", error);
  }
};
```

- [ ] **Step 2: Wire into startup**

In `server/src/index.ts`, add the import next to the other seed import:

```ts
import { seedAppMinVersion } from "./seeds/appMinVersionSeed";
```

In `startServer`, add the call right after `await seedSpecializations();`:

```ts
    await seedSpecializations();
    await seedAppMinVersion();
```

- [ ] **Step 3: Verify it compiles**

Run: `cd server && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Run the dev server once to confirm the seed logs and rows exist**

Run: `cd server && npm run dev` (stop after startup logs appear)
Expected: logs include `✅ App min-version rows ensured.` and no errors. (If a local DB isn't available, skip the run and rely on Task 4's test.)

- [ ] **Step 5: Commit**

```bash
git add server/src/seeds/appMinVersionSeed.ts server/src/index.ts
git commit -m "feat(server): seed app_min_version rows on startup"
```

---

### Task 4: `GET /version/check` endpoint

Public endpoint that reads the row, compares, and returns the client-facing payload.

**Files:**
- Create: `server/src/controllers/appVersion.ts`
- Create: `server/src/routes/appVersion.ts`
- Modify: `server/src/routes/index.ts` (import + mount at `/version`)
- Test: `server/src/tests/appVersion.test.ts`

**Interfaces:**
- Consumes: `isUpdateRequired` (Task 1), `AppMinVersion` model (Task 2), `sendSuccess` / `sendError` from `src/utils/response.ts`, `publicReadRateLimit` from `src/middleware/rateLimitProfiles.ts`.
- Produces: route `GET /version/check?platform=<ios|android>&version=<x.y.z>` returning `sendSuccess(res, 200, ..., { updateRequired, message, storeUrl })`.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/tests/appVersion.test.ts
import request from "supertest";
import app from "../app";
import sequelize from "../db";
import { AppMinVersion } from "../models/appMinVersion";

// Match how the other tests in src/tests bootstrap the DB. If they import a
// shared setup, follow that; otherwise sync + seed the one row we need.
beforeAll(async () => {
  await sequelize.sync();
  await AppMinVersion.upsert({
    platform: "android",
    minVersion: "1.2.0",
    storeUrl: "https://play.google.com/store/apps/details?id=com.juroctech.frontend",
    message: "Please update.",
  });
});

afterAll(async () => {
  await sequelize.close();
});

describe("GET /version/check", () => {
  it("older version → updateRequired true with message + storeUrl", async () => {
    const res = await request(app).get("/version/check?platform=android&version=1.0.0");
    expect(res.status).toBe(200);
    expect(res.body.data.updateRequired).toBe(true);
    expect(res.body.data.storeUrl).toContain("play.google.com");
    expect(res.body.data.message).toBe("Please update.");
  });

  it("current version → updateRequired false", async () => {
    const res = await request(app).get("/version/check?platform=android&version=1.2.0");
    expect(res.status).toBe(200);
    expect(res.body.data.updateRequired).toBe(false);
  });

  it("unknown platform → updateRequired false (fail-open)", async () => {
    const res = await request(app).get("/version/check?platform=web&version=0.1.0");
    expect(res.status).toBe(200);
    expect(res.body.data.updateRequired).toBe(false);
  });

  it("missing params → updateRequired false", async () => {
    const res = await request(app).get("/version/check");
    expect(res.status).toBe(200);
    expect(res.body.data.updateRequired).toBe(false);
  });
});
```

> Before writing the controller, open one existing test in `server/src/tests/` (e.g. `specialization.test.ts`) to confirm the exact import path for the Express app (`../app` vs `../index`) and any shared DB-setup helper, and mirror it here.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/tests/appVersion.test.ts`
Expected: FAIL — route not found (404) / module not found.

- [ ] **Step 3: Write the controller**

```ts
// server/src/controllers/appVersion.ts
import { Request, Response } from "express";
import { AppMinVersion } from "../models/appMinVersion";
import { isUpdateRequired } from "../utils/versionCompare";
import { sendSuccess } from "../utils/response";

// Public endpoint — always 200 with a safe fail-open payload so a bad request
// or missing config never bricks the client.
const NO_UPDATE = { updateRequired: false, message: "", storeUrl: "" };

export const checkVersion = async (req: Request, res: Response) => {
  try {
    const platform = String(req.query.platform || "").toLowerCase();
    const version = String(req.query.version || "");

    if (platform !== "ios" && platform !== "android") {
      return sendSuccess(res, 200, "Version check", NO_UPDATE);
    }

    const config = await AppMinVersion.findOne({ where: { platform } });
    if (!config) {
      return sendSuccess(res, 200, "Version check", NO_UPDATE);
    }

    const updateRequired = isUpdateRequired(version, config.minVersion);

    return sendSuccess(res, 200, "Version check", {
      updateRequired,
      message: updateRequired ? config.message : "",
      storeUrl: config.storeUrl,
    });
  } catch (error) {
    console.error("Error checking app version", error);
    // Fail open: never block the client because of a server error.
    return sendSuccess(res, 200, "Version check", NO_UPDATE);
  }
};
```

- [ ] **Step 4: Write the route**

```ts
// server/src/routes/appVersion.ts
import express from "express";
import { checkVersion } from "../controllers/appVersion";
import { publicReadRateLimit } from "../middleware/rateLimitProfiles";

const router = express.Router();

router.get("/check", publicReadRateLimit, checkVersion);

export default router;
```

- [ ] **Step 5: Mount the route in `routes/index.ts`**

Add the import with the other routers:

```ts
import appVersionRouter from "./appVersion";
```

Mount it with the other `router.use(...)` calls (public, so anywhere in the list is fine):

```ts
router.use("/version", appVersionRouter);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && npx jest src/tests/appVersion.test.ts`
Expected: PASS — all four cases green.

- [ ] **Step 7: Commit**

```bash
git add server/src/controllers/appVersion.ts server/src/routes/appVersion.ts server/src/routes/index.ts server/src/tests/appVersion.test.ts
git commit -m "feat(server): GET /version/check force-update endpoint"
```

---

### Task 5: Frontend `UpdateGate` + wall + wiring

Blocking gate mounted above the navigator. Uses a plain `fetch` (runs once, pre-auth — no need for RTK Query).

**Files:**
- Create: `frontend/src/components/UpdateGate.tsx`
- Modify: `frontend/app/_layout.tsx` (wrap `<Stack>` with `<UpdateGate>`)
- Modify: `frontend/src/lib/i18n/translations.ts` (add keys to both `en` and `ro` maps)

**Interfaces:**
- Consumes: `API_URL` from `src/constants/config.ts`, `Constants.expoConfig?.version` from `expo-constants`, `Platform`, `Linking` from `react-native`, `useLanguage` from `src/lib/i18n/LanguageContext`, `theme` from `src/lib/theme`. Backend `GET /version/check` (Task 4).
- Produces: `<UpdateGate>{children}</UpdateGate>` — renders children unless an update is required, in which case it renders the full-screen wall.

- [ ] **Step 1: Add i18n keys**

In `frontend/src/lib/i18n/translations.ts`, add to the `en` map:

```ts
  updateRequiredTitle: "Update Required",
  updateRequiredButton: "Update Now",
```

Add to the `ro` map (find the corresponding `const ro: Record<string, string> = {` block):

```ts
  updateRequiredTitle: "Actualizare necesară",
  updateRequiredButton: "Actualizează acum",
```

- [ ] **Step 2: Create the `UpdateGate` component**

```tsx
// frontend/src/components/UpdateGate.tsx
import { ReactNode, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Linking,
  Pressable,
} from "react-native";
import Constants from "expo-constants";
import { API_URL } from "../constants/config";
import { theme } from "../lib/theme";
import { useLanguage } from "../lib/i18n/LanguageContext";

interface UpdateInfo {
  updateRequired: boolean;
  message: string;
  storeUrl: string;
}

export default function UpdateGate({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    // Only native builds have a store to send users to. Fail open on web.
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;

    let cancelled = false;
    const check = async () => {
      try {
        const version = Constants.expoConfig?.version ?? "";
        const url = `${API_URL}/version/check?platform=${Platform.OS}&version=${encodeURIComponent(version)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        const body = await res.json();
        const data = body?.data as UpdateInfo | undefined;
        if (!cancelled && data?.updateRequired) {
          setUpdate(data);
        }
      } catch {
        // Fail open: any error (network, timeout, parse) → don't block.
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update?.updateRequired) {
    return <>{children}</>;
  }

  return (
    <View style={styles.overlay}>
      <Text style={styles.title}>{t("updateRequiredTitle")}</Text>
      <Text style={styles.message}>{update.message}</Text>
      <Pressable
        style={styles.button}
        onPress={() => Linking.openURL(update.storeUrl)}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{t("updateRequiredButton")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
```

> Note: confirm `theme.colors.text` and `theme.colors.background` exist in `src/lib/theme.ts`; if the text token has a different name (e.g. `theme.colors.textPrimary`), use the actual one. Do not invent tokens.

- [ ] **Step 3: Wire `UpdateGate` into the root layout**

In `frontend/app/_layout.tsx`, add the import:

```tsx
import UpdateGate from "../src/components/UpdateGate";
```

Wrap the `<Stack>` (and only the Stack — keep `CoachMark`/`TourGate` outside so nothing renders behind the wall). Change:

```tsx
        <RevenueCatIdentityBridge />
        <StatusBar style="light" />
        <Stack
```

so the `<Stack>...</Stack>` block is wrapped:

```tsx
        <RevenueCatIdentityBridge />
        <StatusBar style="light" />
        <UpdateGate>
        <Stack
          screenOptions={{ /* unchanged */ }}
        >
          {/* all <Stack.Screen /> entries unchanged */}
        </Stack>
        </UpdateGate>
        <CoachMark />
        <TourGate />
```

(Leave every `screenOptions` value and `<Stack.Screen>` line exactly as it is — only add the `<UpdateGate>` opening tag before `<Stack` and the closing `</UpdateGate>` after `</Stack>`.)

- [ ] **Step 4: Typecheck the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 5: Manual smoke test (fail-open + block)**

- With the backend seeded at `min_version = 1.0.0` and the app at `1.0.0`: launch the app → it boots normally (no wall).
- Temporarily `UPDATE app_min_version SET min_version='9.0.0' WHERE platform='android';` → relaunch → the wall shows, message renders, **Update Now** opens the Play Store listing.
- Stop the backend → relaunch → app still boots (fail-open confirmed).
- Reset: `UPDATE app_min_version SET min_version='1.0.0' WHERE platform='android';`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/UpdateGate.tsx frontend/app/_layout.tsx frontend/src/lib/i18n/translations.ts
git commit -m "feat(app): force-update gate blocks outdated builds"
```

---

## Self-Review

**Spec coverage:**
- Hard block wall with message + store button → Task 5 (wall) + Task 4 (payload). ✓
- DB row per platform, no redeploy → Task 2 (model) + Task 3 (idempotent seed, `findOrCreate` never clobbers edits). ✓
- Server-side version compare → Task 1 + Task 4. ✓
- Public pre-login endpoint → Task 4 (no `authenticate`, `publicReadRateLimit`). ✓
- Fail-open → Task 1 (malformed→false), Task 4 (catch→NO_UPDATE, unknown platform, missing row), Task 5 (try/catch + 5s timeout + web skip). ✓
- Deep-link to store → Task 5 (`Linking.openURL(storeUrl)`), URLs seeded in Task 3 incl. Apple id `6775085258`. ✓
- i18n for static strings, DB message for body → Task 5 Step 1 + wall. ✓
- No new dependencies → confirmed; uses `expo-constants`, `Linking`, existing jest/sequelize. ✓

**Placeholder scan:** No TBD/TODO; every code step has full content. Two "confirm the actual name" notes (test app-import path, theme token names) are explicit verification instructions, not placeholders — the surrounding code is complete.

**Type consistency:** `isUpdateRequired(current, minimum)` signature identical in Task 1 and Task 4. `AppMinVersion` fields (`platform`, `minVersion`, `storeUrl`, `message`) consistent across Tasks 2–4. Response shape `{ updateRequired, message, storeUrl }` identical in Task 4 controller, Task 4 test, and Task 5 `UpdateInfo`.

**Excluded per spec (not gaps):** admin UI, soft nudge, periodic re-check, per-request 426 gating.
