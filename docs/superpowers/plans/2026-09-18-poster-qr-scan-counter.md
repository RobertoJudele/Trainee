# Poster QR Scan Counter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Printed gym posters carry a QR code that, when scanned, increments a per-gym counter in the backend and serves a Romanian trainer-recruitment landing page.

**Architecture:** One new table, `poster_codes`, holding counter columns incremented in place — there is deliberately no event log. Two public unauthenticated routes (`GET /p/:code`, `GET /p/:code/start`) mounted beside the existing `GET /t/:slug`, plus three admin routes behind `requireAdmin`. The landing page is server-rendered HTML from a pure function, mirroring `services/publicProfilePage.ts`, with design tokens and the logo inlined because the server has no static-asset infrastructure.

**Tech Stack:** Node + Express 4, TypeScript (strict), sequelize-typescript on PostgreSQL, express-validator, Jest + supertest, sharp (one-off, for the logo).

**Spec:** `docs/superpowers/specs/2026-09-18-poster-qr-scan-counter-design.md`

## Global Constraints

- **Server only.** No change to `frontend/`. Signup attribution, QR image generation and any in-app admin screen are out of scope.
- **`npm test` runs `sequelize.sync({ force: true })`, which DROPS EVERY TABLE in whatever `DB_NAME` points at** (`src/tests/setup.ts:16`, `src/db.ts:32`). Before running any test, confirm `DB_NAME` is the local throwaway database (`trainee_db_local` on `127.0.0.1:5432` locally), never `trainee` or `trainee_dev`. There is no `.env.test` in the repo; the DB_* vars must come from the environment.
- **Jest runs serially** (`maxWorkers: 1`) for that same reason. Do not add `test.concurrent`.
- **TypeScript is strict**: no implicit `any`, explicit return types on exported functions, `??` over `||`, optional chaining. Verify with `npm run typecheck` before every commit.
- **Romanian copy is verbatim from the spec.** In particular proof row 1 keeps its missing diacritics ("salile", "singuri") — the handoff explicitly says not to silently correct it. Use the comma-below Romanian letters (ș, ț) in copy the spec writes that way: `București`, `Ești`.
- **Removed from the design, must not appear anywhere:** `Parteneriat oficial · București` and `Locuri limitate`.
- **Kept deliberately:** the eyebrow `OFERTA PENTRU PRIMII MEMBRII`.
- **Design tokens are copied verbatim** from `design_handoff_salvio_trainer_landing/design_files/_ds/salvio-design-system-*/tokens/`. Prefer `var(--token)` over literal hex in page markup.
- **Do not port `support.js`** or the `_ds_bundle.js` runtime from the handoff. It is a prototype runtime; the page is rebuilt as plain HTML.

---

### Task 1: PosterCode model, migration, and registration

**Files:**
- Create: `server/src/models/posterCode.ts`
- Modify: `server/src/db.ts` (import + `models` array)
- Create: `server/migrations/005_add_poster_codes.sql`
- Test: `server/src/tests/posterCodeModel.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `PosterCode` model class with fields `id: number`, `code: string`, `label: string`, `gymId?: number | null`, `gymLogoUrl?: string | null`, `scanCount: number`, `appleClickCount: number`, `playClickCount: number`, `lastScannedAt?: Date | null`, `isActive: boolean`, `createdAt: Date`, `updatedAt: Date`.

- [ ] **Step 1: Write the failing test**

Create `server/src/tests/posterCodeModel.test.ts`:

```ts
import { describe, it, expect } from "@jest/globals";
import { PosterCode } from "../models/posterCode";

describe("PosterCode model", () => {
  it("creates a code with zeroed counters, active by default", async () => {
    const poster = await PosterCode.create({
      code: "abc234",
      label: "World Class Dorobanți",
    });

    expect(poster.scanCount).toBe(0);
    expect(poster.appleClickCount).toBe(0);
    expect(poster.playClickCount).toBe(0);
    expect(poster.isActive).toBe(true);
    expect(poster.lastScannedAt ?? null).toBeNull();
    expect(poster.gymId ?? null).toBeNull();
    expect(poster.gymLogoUrl ?? null).toBeNull();
  });

  it("rejects a duplicate code", async () => {
    await PosterCode.create({ code: "dup234", label: "Sala A" });

    await expect(
      PosterCode.create({ code: "dup234", label: "Sala B" })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- posterCodeModel`
Expected: FAIL — `Cannot find module '../models/posterCode'`.

- [ ] **Step 3: Write the model**

Create `server/src/models/posterCode.ts`:

```ts
import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  AllowNull,
  Default,
  Unique,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { Gym } from "./gym";

/**
 * One printed poster campaign per gym. Counters are incremented in place and
 * there is deliberately no event log, so this table holds totals, not history —
 * see docs/superpowers/specs/2026-09-18-poster-qr-scan-counter-design.md.
 *
 * `lastScannedAt` is the one time signal kept: it costs nothing (written in the
 * same UPDATE as the increment) and is what separates a dead poster from a live
 * one.
 */
@Table({
  tableName: "poster_codes",
  timestamps: true,
})
export class PosterCode extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @Unique
  @AllowNull(false)
  @Column({ type: DataType.STRING(32), field: "code" })
  code!: string;

  /** Free-text gym name, so a gym with no `gyms` row can still be postered. */
  @AllowNull(false)
  @Column({ type: DataType.STRING(120), field: "label" })
  label!: string;

  @ForeignKey(() => Gym)
  @AllowNull(true)
  @Column({ type: DataType.INTEGER, field: "gym_id" })
  gymId?: number | null;

  @AllowNull(true)
  @Column({ type: DataType.STRING(500), field: "gym_logo_url" })
  gymLogoUrl?: string | null;

  @Default(0)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: "scan_count" })
  scanCount!: number;

  @Default(0)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: "apple_click_count" })
  appleClickCount!: number;

  @Default(0)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: "play_click_count" })
  playClickCount!: number;

  @AllowNull(true)
  @Column({ type: DataType.DATE, field: "last_scanned_at" })
  lastScannedAt?: Date | null;

  @Default(true)
  @AllowNull(false)
  @Column({ type: DataType.BOOLEAN, field: "is_active" })
  isActive!: boolean;

  @CreatedAt
  @Column({ field: "created_at" })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: "updated_at" })
  updatedAt!: Date;

  @BelongsTo(() => Gym)
  gym?: Gym;
}
```

- [ ] **Step 4: Register the model**

In `server/src/db.ts`, add the import beside the other model imports:

```ts
import { PosterCode } from "./models/posterCode";
```

and add `PosterCode,` to the end of the `models: [...]` array (after `UserBlock,`).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npm test -- posterCodeModel`
Expected: PASS, 2 tests.

- [ ] **Step 6: Write the migration**

The app boots with `sequelize.sync({ alter: false })` (`src/index.ts:109`), which does **not** create a new model's table on an existing database. Create `server/migrations/005_add_poster_codes.sql`:

```sql
-- Per-gym poster QR codes and their scan / store-click counters.
--
-- Why a manual SQL file: the app boots with sequelize.sync({ alter: false }), so a
-- new model is NOT created automatically on an existing database. Run this once
-- per environment.
--
-- Local:  docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" < migrations/005_add_poster_codes.sql
-- Prod:   same, against the production db container (see server/DEPLOY.md).
--
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS poster_codes (
  id                SERIAL PRIMARY KEY,
  code              VARCHAR(32)  NOT NULL UNIQUE,
  label             VARCHAR(120) NOT NULL,
  gym_id            INTEGER      NULL REFERENCES gyms(id) ON DELETE SET NULL,
  gym_logo_url      VARCHAR(500) NULL,
  scan_count        INTEGER      NOT NULL DEFAULT 0,
  apple_click_count INTEGER      NOT NULL DEFAULT 0,
  play_click_count  INTEGER      NOT NULL DEFAULT 0,
  last_scanned_at   TIMESTAMP WITH TIME ZONE NULL,
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Every scan looks the row up by code.
CREATE INDEX IF NOT EXISTS poster_codes_code_idx ON poster_codes (code);
```

- [ ] **Step 7: Typecheck and commit**

```bash
cd server && npm run typecheck
git add src/models/posterCode.ts src/db.ts migrations/005_add_poster_codes.sql src/tests/posterCodeModel.test.ts
git commit -m "feat(poster): add poster_codes model and migration"
```

---

### Task 2: Poster code generator

**Files:**
- Create: `server/src/utils/posterCode.ts`
- Test: `server/src/tests/posterCodeGenerator.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `POSTER_CODE_PATTERN: RegExp` and `generatePosterCode(length?: number): string`.

- [ ] **Step 1: Write the failing test**

Create `server/src/tests/posterCodeGenerator.test.ts`:

```ts
import { describe, it, expect } from "@jest/globals";
import { generatePosterCode, POSTER_CODE_PATTERN } from "../utils/posterCode";

describe("generatePosterCode", () => {
  it("returns a six-character code matching the accepted pattern", () => {
    const code = generatePosterCode();

    expect(code).toHaveLength(6);
    expect(POSTER_CODE_PATTERN.test(code)).toBe(true);
  });

  it("never emits visually ambiguous characters", () => {
    // A code is read off a poster and typed by hand often enough that 0/o and
    // 1/l/i are worth excluding outright.
    const codes = Array.from({ length: 200 }, () => generatePosterCode());

    for (const code of codes) {
      expect(code).not.toMatch(/[01oli]/);
    }
  });

  it("is random enough that 200 codes are essentially all distinct", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generatePosterCode()));

    expect(codes.size).toBeGreaterThan(190);
  });
});

describe("POSTER_CODE_PATTERN", () => {
  it("accepts a hand-written slug and rejects unsafe input", () => {
    expect(POSTER_CODE_PATTERN.test("wc-dorobanti")).toBe(true);
    expect(POSTER_CODE_PATTERN.test("ab")).toBe(false);
    expect(POSTER_CODE_PATTERN.test("Has-Upper")).toBe(false);
    expect(POSTER_CODE_PATTERN.test("has space")).toBe(false);
    expect(POSTER_CODE_PATTERN.test("../etc")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- posterCodeGenerator`
Expected: FAIL — `Cannot find module '../utils/posterCode'`.

- [ ] **Step 3: Write the implementation**

Create `server/src/utils/posterCode.ts`:

```ts
import { randomInt } from "crypto";

/**
 * Lowercase alphanumerics minus the characters that are misread off a printed
 * poster: 0/o, 1/l/i.
 */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** What an admin-supplied code may look like. */
export const POSTER_CODE_PATTERN = /^[a-z0-9-]{3,32}$/;

/**
 * A short random code for a poster URL. Short matters: fewer characters make a
 * denser QR, which scans from further away on a gym wall.
 */
export const generatePosterCode = (length: number = 6): string => {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- posterCodeGenerator`
Expected: PASS, 4 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
cd server && npm run typecheck
git add src/utils/posterCode.ts src/tests/posterCodeGenerator.test.ts
git commit -m "feat(poster): add unambiguous poster code generator"
```

---

### Task 3: Counting rules (what must not be counted)

**Files:**
- Create: `server/src/services/posterScanCounting.ts`
- Test: `server/src/tests/posterScanCounting.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `isCrawlerUserAgent(userAgent: string | undefined): boolean`
  - `detectStorePlatform(userAgent: string | undefined): "ios" | "android" | "unknown"`
  - `shouldCountPosterHit(req: Request): boolean`
  - `resetPosterFloodBuckets(): void` (test seam)

This module holds only in-memory logic and does no database work, so it is unit-testable without a DB — the same split `services/profileViewTracking.ts` uses for its rate-limit buckets.

- [ ] **Step 1: Write the failing test**

Create `server/src/tests/posterScanCounting.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "@jest/globals";
import { Request } from "express";
import {
  detectStorePlatform,
  isCrawlerUserAgent,
  resetPosterFloodBuckets,
  shouldCountPosterHit,
} from "../services/posterScanCounting";

const fakeRequest = (overrides: {
  method?: string;
  userAgent?: string;
  ip?: string;
}): Request =>
  ({
    method: overrides.method ?? "GET",
    headers: overrides.userAgent ? { "user-agent": overrides.userAgent } : {},
    ip: overrides.ip ?? "203.0.113.10",
    socket: { remoteAddress: overrides.ip ?? "203.0.113.10" },
  } as unknown as Request);

describe("isCrawlerUserAgent", () => {
  it("matches the link-preview bots that fetch a shared poster URL", () => {
    expect(isCrawlerUserAgent("facebookexternalhit/1.1")).toBe(true);
    expect(isCrawlerUserAgent("WhatsApp/2.23")).toBe(true);
    expect(isCrawlerUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isCrawlerUserAgent("TelegramBot (like TwitterBot)")).toBe(true);
  });

  it("does not match a real phone browser", () => {
    expect(
      isCrawlerUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
      )
    ).toBe(false);
  });
});

describe("detectStorePlatform", () => {
  it("reads the platform off the user agent", () => {
    expect(
      detectStorePlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")
    ).toBe("ios");
    expect(detectStorePlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe(
      "android"
    );
    expect(detectStorePlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe(
      "unknown"
    );
    expect(detectStorePlatform(undefined)).toBe("unknown");
  });
});

describe("shouldCountPosterHit", () => {
  beforeEach(() => {
    resetPosterFloodBuckets();
  });

  it("counts a normal phone visit", () => {
    expect(
      shouldCountPosterHit(
        fakeRequest({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" })
      )
    ).toBe(true);
  });

  it("does not count a HEAD request", () => {
    // Express serves GET handlers for HEAD too, so a link checker would
    // otherwise double every scan.
    expect(
      shouldCountPosterHit(
        fakeRequest({ method: "HEAD", userAgent: "Mozilla/5.0 (iPhone)" })
      )
    ).toBe(false);
  });

  it("does not count a link-preview crawler", () => {
    expect(
      shouldCountPosterHit(fakeRequest({ userAgent: "facebookexternalhit/1.1" }))
    ).toBe(false);
  });

  it("stops counting one IP past the flood threshold but keeps counting another", () => {
    const flooder = { userAgent: "Mozilla/5.0 (iPhone)", ip: "198.51.100.5" };
    let counted = 0;
    for (let i = 0; i < 200; i += 1) {
      if (shouldCountPosterHit(fakeRequest(flooder))) counted += 1;
    }

    expect(counted).toBe(120);
    expect(
      shouldCountPosterHit(
        fakeRequest({ userAgent: "Mozilla/5.0 (iPhone)", ip: "198.51.100.6" })
      )
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- posterScanCounting`
Expected: FAIL — `Cannot find module '../services/posterScanCounting'`.

- [ ] **Step 3: Write the implementation**

Create `server/src/services/posterScanCounting.ts`:

```ts
import { Request } from "express";

/**
 * Which poster hits count. Each rule here exists because the hit it excludes
 * would otherwise silently inflate every number on the admin list.
 */

/** Bots that fetch a URL the moment it is pasted into a chat. */
const CRAWLER_PATTERN =
  /(facebookexternalhit|WhatsApp|Twitterbot|TelegramBot|Discordbot|Slackbot|bingbot|Googlebot|LinkedInBot|Applebot)/i;

const FLOOD_WINDOW_MS = 60_000;
const FLOOD_MAX_HITS = 120;
/** Bounds memory if a scripted flood cycles through many source addresses. */
const MAX_TRACKED_IPS = 5_000;

const floodBuckets = new Map<string, number[]>();

const getRequestIp = (req: Request): string => {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0].split(",")[0].trim();
  }

  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
};

export const isCrawlerUserAgent = (userAgent: string | undefined): boolean =>
  typeof userAgent === "string" && CRAWLER_PATTERN.test(userAgent);

export const detectStorePlatform = (
  userAgent: string | undefined
): "ios" | "android" | "unknown" => {
  if (typeof userAgent !== "string") return "unknown";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "unknown";
};

/**
 * Deliberately loose, and deliberately not `publicReadRateLimit`: a gym NATs
 * every member behind one IP, so a normal limiter would refuse real scanners
 * and undercount exactly the posters that are working best. Over the threshold
 * the page is still served — only the increment is skipped.
 */
const isFloodLimited = (ip: string): boolean => {
  const now = Date.now();

  if (floodBuckets.size > MAX_TRACKED_IPS) {
    floodBuckets.clear();
  }

  const recent = (floodBuckets.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < FLOOD_WINDOW_MS
  );
  recent.push(now);
  floodBuckets.set(ip, recent);

  return recent.length > FLOOD_MAX_HITS;
};

export const shouldCountPosterHit = (req: Request): boolean => {
  // Express matches GET handlers for HEAD as well.
  if (req.method === "HEAD") return false;

  const userAgent =
    typeof req.headers["user-agent"] === "string"
      ? req.headers["user-agent"]
      : undefined;

  if (isCrawlerUserAgent(userAgent)) return false;

  return !isFloodLimited(getRequestIp(req));
};

/** Test seam — the buckets are module-level state. */
export const resetPosterFloodBuckets = (): void => {
  floodBuckets.clear();
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- posterScanCounting`
Expected: PASS, 8 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
cd server && npm run typecheck
git add src/services/posterScanCounting.ts src/tests/posterScanCounting.test.ts
git commit -m "feat(poster): add scan counting rules for bots, HEAD and floods"
```

---

### Task 4: Inlined page assets (tokens, logo, icons)

**Files:**
- Create (generated): `server/src/services/posterLandingTokens.ts`
- Create (generated): `server/src/services/posterLandingLogo.ts`
- Create: `server/src/services/posterLandingIcons.ts`
- Test: `server/src/tests/posterLandingAssets.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `POSTER_TOKENS_CSS: string` — the design-system token CSS, verbatim.
  - `SALVIO_LOGO_DATA_URI: string` — `data:image/png;base64,…`, a 64×64 logo.
  - `POSTER_ICONS: { chevronRight: string; mapPin: string; tag: string; badgeCheck: string }` — inline SVG markup, each taking `currentColor`.

Everything the page needs ships inside compiled `.js`. This matters: `tsc` compiles `.ts` only and copies no binary or CSS files into `dist/`, so anything read from disk at runtime would work in dev and 404 in production.

- [ ] **Step 1: Generate the token module**

Run from `server/`:

```bash
node -e '
const fs = require("fs");
const dsRoot = "../design_handoff_salvio_trainer_landing/design_files/_ds";
const dir = fs.readdirSync(dsRoot).find((d) => d.startsWith("salvio-design-system-"));
const base = dsRoot + "/" + dir + "/tokens/";
// fonts.css first: it holds the @import, which must be the first rule in a stylesheet.
const order = ["fonts.css","colors.css","typography.css","spacing.css","shape.css","elevation.css","motion.css","base.css"];
const css = order.map((f) => fs.readFileSync(base + f, "utf8").trim()).join("\n");
const escaped = css.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
fs.writeFileSync("src/services/posterLandingTokens.ts",
  "// GENERATED — do not edit by hand.\n" +
  "// Verbatim concatenation of design_handoff_salvio_trainer_landing/design_files/_ds/\n" +
  "// " + dir + "/tokens/, @import first. Inlined rather than served because the\n" +
  "// server has no static-asset route and tsc copies no .css into dist/.\n" +
  "// Regenerate with the command in Task 4 of\n" +
  "// docs/superpowers/plans/2026-09-18-poster-qr-scan-counter.md\n" +
  "export const POSTER_TOKENS_CSS = `" + escaped + "`;\n");
console.log("tokens:", css.length, "chars");
'
```

Expected: prints roughly `tokens: 6000 chars`.

- [ ] **Step 2: Generate the logo module**

The source PNG is 730 KB and renders at 32 px. Downscale to 64×64 (2× for retina) and inline it. Run from `server/`:

```bash
node -e '
const sharp = require("sharp");
const fs = require("fs");
sharp("../design_handoff_salvio_trainer_landing/design_files/assets/salvio-logo.png")
  .resize(64, 64, { fit: "cover" })
  .png({ compressionLevel: 9 })
  .toBuffer()
  .then((buf) => {
    fs.writeFileSync("src/services/posterLandingLogo.ts",
      "// GENERATED — do not edit by hand.\n" +
      "// 64x64 of design_files/assets/salvio-logo.png (730 KB original), inlined as a\n" +
      "// data URI: tsc copies no binary assets into dist/ and the server serves no\n" +
      "// static files. Regenerate with the command in Task 4 of\n" +
      "// docs/superpowers/plans/2026-09-18-poster-qr-scan-counter.md\n" +
      "export const SALVIO_LOGO_DATA_URI =\n  \"data:image/png;base64," + buf.toString("base64") + "\";\n");
    console.log("logo:", buf.length, "bytes");
  });
'
```

Expected: prints a size in the low single-digit KB. If it exceeds ~20 KB, re-run with `.png({ compressionLevel: 9, palette: true })`.

- [ ] **Step 3: Write the icon module**

Create `server/src/services/posterLandingIcons.ts`:

```ts
/**
 * The four Lucide icons the landing page uses, as inline SVG. The design handoff
 * renders them through its prototype runtime (`_ds_bundle.js`), which is
 * explicitly not to be ported, and a whole icon library for four glyphs is not
 * worth a script tag. Each inherits `currentColor`.
 */
const svg = (size: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="flex:none">${body}</svg>`;

export const POSTER_ICONS = {
  chevronRight: svg(20, `<path d="m9 18 6-6-6-6"/>`),
  mapPin: svg(
    18,
    `<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>`
  ),
  tag: svg(
    18,
    `<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>`
  ),
  badgeCheck: svg(
    16,
    `<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>`
  ),
} as const;
```

- [ ] **Step 4: Write the test**

Create `server/src/tests/posterLandingAssets.test.ts`:

```ts
import { describe, it, expect } from "@jest/globals";
import { POSTER_TOKENS_CSS } from "../services/posterLandingTokens";
import { SALVIO_LOGO_DATA_URI } from "../services/posterLandingLogo";
import { POSTER_ICONS } from "../services/posterLandingIcons";

describe("poster landing assets", () => {
  it("carries the design-system tokens the page depends on", () => {
    expect(POSTER_TOKENS_CSS).toContain("--green-500:#12B177");
    expect(POSTER_TOKENS_CSS).toContain("--ink-900:#14181A");
    expect(POSTER_TOKENS_CSS).toContain("--shadow-brand");
    expect(POSTER_TOKENS_CSS).toContain("--font-display");
  });

  it("puts the font @import first, since a later @import is ignored", () => {
    expect(POSTER_TOKENS_CSS.trimStart().startsWith("/*")).toBe(true);
    const importIndex = POSTER_TOKENS_CSS.indexOf("@import");
    const firstRuleIndex = POSTER_TOKENS_CSS.indexOf(":root{");
    expect(importIndex).toBeGreaterThan(-1);
    expect(importIndex).toBeLessThan(firstRuleIndex);
  });

  it("inlines a small logo", () => {
    expect(SALVIO_LOGO_DATA_URI.startsWith("data:image/png;base64,")).toBe(true);
    // The 730 KB source would be ~1 MB of base64 on every page load.
    expect(SALVIO_LOGO_DATA_URI.length).toBeLessThan(40_000);
  });

  it("renders icons that inherit colour and carry no fixed fill", () => {
    for (const icon of Object.values(POSTER_ICONS)) {
      expect(icon).toContain('stroke="currentColor"');
      expect(icon).toContain('aria-hidden="true"');
    }
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npm test -- posterLandingAssets`
Expected: PASS, 4 tests. (The generated modules already exist from steps 1–2, so this task's test is written after its inputs — the generators are mechanical, with nothing to drive out test-first.)

- [ ] **Step 6: Typecheck and commit**

```bash
cd server && npm run typecheck
git add src/services/posterLandingTokens.ts src/services/posterLandingLogo.ts src/services/posterLandingIcons.ts src/tests/posterLandingAssets.test.ts
git commit -m "feat(poster): inline design tokens, logo and icons for the landing page"
```

---

### Task 5: Landing page renderer

**Files:**
- Create: `server/src/services/posterLandingPage.ts`
- Test: `server/src/tests/posterLandingPage.test.ts`

**Interfaces:**
- Consumes: `esc`, `safeUrl` from `./publicProfilePage`; `POSTER_TOKENS_CSS`, `SALVIO_LOGO_DATA_URI`, `POSTER_ICONS` from Task 4.
- Produces:
  - `interface PosterLandingOffer { isOpen: boolean; months: number; deadline?: string }`
  - `interface PosterLandingData { gymName: string | null; gymLogoUrl?: string | null; startUrl: string; offer: PosterLandingOffer; now?: Date }`
  - `formatCountdown(msLeft: number): string`
  - `formatDeadlineLabel(deadlineIso: string): string`
  - `formatMonthsLabel(months: number): string`
  - `renderPosterLanding(data: PosterLandingData): string`

A pure function returning HTML, the same shape as `renderPublicProfile`. No DB, no request object — which is what makes the copy and escaping rules cheap to test.

- [ ] **Step 1: Write the failing test**

Create `server/src/tests/posterLandingPage.test.ts`:

```ts
import { describe, it, expect } from "@jest/globals";
import {
  formatCountdown,
  formatDeadlineLabel,
  formatMonthsLabel,
  renderPosterLanding,
} from "../services/posterLandingPage";

const openOffer = {
  isOpen: true,
  months: 3,
  deadline: "2026-09-30T23:59:59+03:00",
};

const render = (overrides: Partial<Parameters<typeof renderPosterLanding>[0]> = {}) =>
  renderPosterLanding({
    gymName: "World Class Dorobanți",
    startUrl: "/p/k7fm2q/start",
    offer: openOffer,
    now: new Date("2026-09-19T17:17:59+03:00"),
    ...overrides,
  });

describe("formatCountdown", () => {
  it("formats days unpadded and time zero-padded", () => {
    const ms = 11 * 864e5 + 6 * 36e5 + 42 * 6e4;
    expect(formatCountdown(ms)).toBe("11z 06:42");
  });

  it("clamps at zero rather than going negative", () => {
    expect(formatCountdown(-5000)).toBe("0z 00:00");
  });
});

describe("formatMonthsLabel", () => {
  it("uses Romanian number agreement", () => {
    expect(formatMonthsLabel(1)).toBe("1 lună gratis");
    expect(formatMonthsLabel(3)).toBe("3 luni gratis");
    expect(formatMonthsLabel(24)).toBe("24 de luni gratis");
  });
});

describe("formatDeadlineLabel", () => {
  it("renders the deadline as a Romanian date in Bucharest time", () => {
    expect(formatDeadlineLabel("2026-09-30T23:59:59+03:00")).toBe("30 septembrie");
  });
});

describe("renderPosterLanding", () => {
  it("puts the gym name in the headline", () => {
    const html = render();
    expect(html).toContain("Ești antrenor la");
    expect(html).toContain("World Class Dorobanți");
  });

  it("escapes a gym name so it cannot inject markup", () => {
    const html = render({ gymName: '<script>alert(1)</script>' });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("falls back to a gym-neutral headline, never the placeholder", () => {
    const html = render({ gymName: null });
    expect(html).toContain("Ești antrenor în");
    expect(html).toContain("București");
    expect(html).not.toContain("[Nume Sală]");
  });

  it("steps the headline down for a long gym name instead of truncating", () => {
    expect(render({ gymName: "Sala" })).toContain("font-size:44px");
    expect(render({ gymName: "World Class Dorobanți" })).toContain("font-size:38px");
  });

  it("renders the offer card with a server-side first countdown frame", () => {
    const html = render();
    expect(html).toContain("OFERTA PENTRU PRIMII MEMBRII");
    expect(html).toContain("3 luni gratis");
    expect(html).toContain("30 septembrie");
    expect(html).toContain("11z 06:42");
    expect(html).toContain('data-deadline="2026-09-30T23:59:59+03:00"');
  });

  it("omits the offer entirely when the founding grant has closed", () => {
    const html = render({ offer: { isOpen: false, months: 0 } });
    expect(html).not.toContain("OFERTA PENTRU PRIMII MEMBRII");
    expect(html).not.toContain("Închis");
    expect(html).toContain("Începe în 90 de secunde");
  });

  it("points the single CTA at the start URL", () => {
    const html = render();
    expect(html).toContain('href="/p/k7fm2q/start"');
    expect(html.match(/Începe în 90 de secunde/g)).toHaveLength(1);
  });

  it("keeps the client's copy verbatim, missing diacritics included", () => {
    expect(render()).toContain(
      "Apari la toate salile la care antrenezi si lasa lumea sa te cunoasca."
    );
  });

  it("drops the two claims removed in review", () => {
    const html = render();
    expect(html).not.toContain("Locuri limitate");
    expect(html).not.toContain("Parteneriat oficial");
  });

  it("shows the gym logo only when one is set, and only over http(s)", () => {
    expect(render()).not.toContain("gym-logo");
    expect(render({ gymLogoUrl: "https://cdn.example.com/g.png" })).toContain(
      "https://cdn.example.com/g.png"
    );
    expect(render({ gymLogoUrl: "javascript:alert(1)" })).not.toContain("javascript:");
  });

  it("keeps crawlers out of the index", () => {
    expect(render()).toContain('<meta name="robots" content="noindex">');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- posterLandingPage`
Expected: FAIL — `Cannot find module '../services/posterLandingPage'`.

- [ ] **Step 3: Write the renderer**

Create `server/src/services/posterLandingPage.ts`:

```ts
import { esc, safeUrl } from "./publicProfilePage";
import { POSTER_TOKENS_CSS } from "./posterLandingTokens";
import { SALVIO_LOGO_DATA_URI } from "./posterLandingLogo";
import { POSTER_ICONS } from "./posterLandingIcons";

/**
 * The QR poster landing page: a trainer scans a code off a gym wall and gets
 * roughly ten seconds of attention, so the page has one CTA and no navigation.
 *
 * Visual spec: design_handoff_salvio_trainer_landing/README.md. Rebuilt rather
 * than ported — the handoff's streaming-component runtime is not shipped.
 */

export interface PosterLandingOffer {
  isOpen: boolean;
  months: number;
  deadline?: string;
}

export interface PosterLandingData {
  /** Gym name for the headline, or null for the gym-neutral fallback. */
  gymName: string | null;
  gymLogoUrl?: string | null;
  /** Where the single CTA points — the counted store redirect. */
  startUrl: string;
  offer: PosterLandingOffer;
  /** Injectable clock, so the first countdown frame is testable. */
  now?: Date;
}

const FALLBACK_CITY = "București";
/** Past this, a headline would wrap to four lines on a 360px screen. */
const LONG_GYM_NAME = 16;

const pad = (value: number): string => (value < 10 ? `0${value}` : String(value));

export const formatCountdown = (msLeft: number): string => {
  const ms = Math.max(0, msLeft);
  const days = Math.floor(ms / 864e5);
  const hours = Math.floor(ms / 36e5) % 24;
  const minutes = Math.floor(ms / 6e4) % 60;
  // Seconds are deliberately not shown: a ticking seconds digit reads as
  // pressure, which is off-register for the design system.
  return `${days}z ${pad(hours)}:${pad(minutes)}`;
};

export const formatDeadlineLabel = (deadlineIso: string): string =>
  new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Bucharest",
    day: "numeric",
    month: "long",
  }).format(new Date(deadlineIso));

export const formatMonthsLabel = (months: number): string => {
  if (months === 1) return "1 lună gratis";
  // Romanian takes "de" before the noun from 20 upwards.
  return months >= 20 ? `${months} de luni gratis` : `${months} luni gratis`;
};

const pageCss = `
.wrap{min-height:100%;background:var(--ink-900);display:flex;justify-content:center}
.col{width:100%;max-width:430px;background:var(--surface-canvas);display:flex;flex-direction:column}
.hero{background:var(--ink-900);padding:16px 20px 24px;display:flex;flex-direction:column;gap:20px}
.brand{display:flex;align-items:center;gap:10px}
.brand img{width:32px;height:32px;border-radius:8px;display:block}
.brand-word{font:var(--weight-black) 17px/1 var(--font-display);font-stretch:75%;text-transform:uppercase;letter-spacing:-0.01em;color:var(--white)}
.brand-div{width:1px;height:18px;background:var(--ink-700)}
.hero h1{margin:0;font-family:var(--font-display);font-weight:var(--weight-black);line-height:0.94;font-stretch:75%;text-transform:uppercase;letter-spacing:-0.015em;color:var(--white);text-wrap:balance}
.hero h1 span{color:var(--green-400)}
.sub{margin:0;font:var(--weight-medium) 16px/1.5 var(--font-ui);color:var(--ink-300);max-width:34ch}
.offer-wrap{background:var(--ink-900);padding:0 20px 20px}
.offer{background:var(--green-500);border-radius:var(--radius-card);padding:20px;display:flex;flex-direction:column;gap:14px}
.offer-eyebrow{font:var(--type-label);letter-spacing:var(--tracking-label);text-transform:uppercase;color:var(--green-900)}
.offer-head{font:var(--weight-black) 30px/1.0 var(--font-display);font-stretch:75%;text-transform:uppercase;letter-spacing:-0.015em;color:var(--ink-900)}
.offer-row{display:flex;align-items:center;gap:10px;border-top:1px solid rgba(6,76,49,.22)}
.countdown{font:var(--weight-semibold) 22px/1 var(--font-mono);color:var(--ink-900);font-variant-numeric:tabular-nums;padding-top:12px}
.deadline{font:var(--weight-semibold) 11px/1.3 var(--font-mono);letter-spacing:var(--tracking-label);text-transform:uppercase;color:var(--green-900);padding-top:12px}
.action{background:var(--surface-canvas);padding:20px;display:flex;flex-direction:column;gap:16px;border-radius:var(--radius-xl) var(--radius-xl) 0 0;margin-top:-4px}
.cta{display:flex;align-items:center;justify-content:center;gap:8px;height:56px;border-radius:var(--radius-control);background:var(--green-500);color:var(--white);font:var(--weight-bold) 17px/1 var(--font-ui);text-decoration:none;box-shadow:var(--shadow-brand);transition:background-color var(--duration-fast) var(--ease-standard),transform var(--duration-fast) var(--ease-standard)}
.cta:hover{background:var(--green-600);color:var(--white);text-decoration:none}
.cta:active{background:var(--green-700);transform:scale(var(--press-scale))}
.cta:focus-visible{outline:none;box-shadow:var(--ring-focus)}
.explainer{margin:0;font:var(--weight-medium) 15px/1.55 var(--font-ui);color:var(--text-body)}
.proofs{display:flex;flex-direction:column;gap:12px;padding-top:4px}
.proof{display:flex;align-items:center;gap:10px;color:var(--text-body)}
.proof span{font:var(--type-body-sm);color:var(--text-body)}
.trust{background:var(--surface-canvas);padding:8px 20px 32px;display:flex;flex-direction:column;gap:12px}
.lockup{background:var(--surface-card);border:1px solid var(--border-subtle);border-radius:var(--radius-card);padding:16px;display:flex;align-items:center;gap:14px}
.lockup img{border-radius:9px;display:block;flex:none}
.lockup-div{width:1px;height:28px;background:var(--border-subtle);flex:none}
.lockup-text{display:flex;flex-direction:column;gap:3px;min-width:0}
.lockup-name{font:var(--weight-bold) 13px/1.2 var(--font-ui);color:var(--text-strong)}
.lockup-meta{font:var(--type-label);letter-spacing:var(--tracking-label);text-transform:uppercase;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bottom{display:flex;align-items:center;gap:12px;padding:0 4px}
.ig{display:flex;align-items:center;gap:6px;font:var(--weight-semibold) 13px/1 var(--font-mono);color:var(--text-muted);text-decoration:none}
.ig:hover{color:var(--green-700);text-decoration:none}
`;

/**
 * Ticks the countdown from the fixed ISO deadline in the markup — never from the
 * visitor's local midnight — and renders over a server-rendered first frame, so
 * the block never flashes empty.
 */
const countdownScript = `
(function(){
  var el=document.getElementById("poster-countdown");
  if(!el)return;
  var deadline=new Date(el.getAttribute("data-deadline")).getTime();
  if(isNaN(deadline))return;
  function pad(n){return n<10?"0"+n:""+n}
  function tick(){
    var ms=Math.max(0,deadline-Date.now());
    var d=Math.floor(ms/864e5),h=Math.floor(ms/36e5)%24,m=Math.floor(ms/6e4)%60;
    el.textContent=d+"z "+pad(h)+":"+pad(m);
  }
  tick();
  setInterval(tick,1000);
})();
`;

const offerBlock = (offer: PosterLandingOffer, now: Date): string => {
  // Closed offers drop the card rather than rendering "Închis" on a poster that
  // is still hanging on a wall.
  if (!offer.isOpen || !offer.deadline) return "";

  const msLeft = new Date(offer.deadline).getTime() - now.getTime();

  return `
  <div class="offer-wrap">
    <div class="offer">
      <span class="offer-eyebrow">OFERTA PENTRU PRIMII MEMBRII</span>
      <div class="offer-head">${esc(formatMonthsLabel(offer.months))}</div>
      <div class="offer-row">
        <div class="countdown" id="poster-countdown" data-deadline="${esc(offer.deadline)}">${esc(
    formatCountdown(msLeft)
  )}</div>
        <div class="deadline">până pe<br>${esc(formatDeadlineLabel(offer.deadline))}</div>
      </div>
    </div>
  </div>`;
};

export const renderPosterLanding = (data: PosterLandingData): string => {
  const now = data.now ?? new Date();
  const gymName = data.gymName?.trim() ? data.gymName.trim() : null;
  const headlineSize = gymName && gymName.length > LONG_GYM_NAME ? "38px" : "44px";
  const headline = gymName
    ? `Ești antrenor la <span>${esc(gymName)}</span>?`
    : `Ești antrenor în <span>${esc(FALLBACK_CITY)}</span>?`;
  const gymLogo = safeUrl(data.gymLogoUrl);
  const offer = offerBlock(data.offer, now);

  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Devino antrenor pe Salvio</title>
<style>${POSTER_TOKENS_CSS}
body{margin:0;background:var(--ink-900)}
${pageCss}</style>
</head>
<body>
<div class="wrap">
<div class="col">

  <div class="hero">
    <div class="brand">
      <img src="${SALVIO_LOGO_DATA_URI}" alt="Salvio" width="32" height="32">
      <span class="brand-word">Salvio</span>
      <span class="brand-div"></span>
    </div>
    <h1 style="font-size:${headlineSize}">${headline}</h1>
    <p class="sub">Nu e o listă cu 700 de nume. E harta sălii în care ești acum.</p>
  </div>
${offer}
  <div class="action">
    <a class="cta" href="${esc(data.startUrl)}">Începe în 90 de secunde ${
    POSTER_ICONS.chevronRight
  }</a>
    <p class="explainer">Clienții din sala ta te găsesc singuri: îți văd specializarea și tariful înainte să scrie un mesaj. Tu nu abordezi pe nimeni.</p>
    <div class="proofs">
      <div class="proof">${
        POSTER_ICONS.mapPin
      }<span>Apari la toate salile la care antrenezi si lasa lumea sa te cunoasca.</span></div>
      <div class="proof">${
        POSTER_ICONS.tag
      }<span>Tariful tău, stabilit de tine, vizibil de la început.</span></div>
    </div>
  </div>

  <div class="trust">
    <div class="lockup">
      <img src="${SALVIO_LOGO_DATA_URI}" alt="Salvio" width="36" height="36">
      <span class="lockup-div"></span>${
        gymLogo
          ? `\n      <img class="gym-logo" src="${esc(
              gymLogo
            )}" alt="" width="36" height="36">`
          : ""
      }
      <div class="lockup-text">
        <span class="lockup-name">Salvio</span>
        <span class="lockup-meta">${esc((gymName ?? FALLBACK_CITY).toUpperCase())}</span>
      </div>
    </div>
    <div class="bottom">
      <a class="ig" href="https://instagram.com/salvio" rel="nofollow noopener">${
        POSTER_ICONS.badgeCheck
      }@salvio</a>
    </div>
  </div>

</div>
</div>
<script>${countdownScript}</script>
</body>
</html>`;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- posterLandingPage`
Expected: PASS, 15 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
cd server && npm run typecheck
git add src/services/posterLandingPage.ts src/tests/posterLandingPage.test.ts
git commit -m "feat(poster): render the Romanian trainer landing page"
```

---

### Task 6: Public scan and CTA routes

**Files:**
- Create: `server/src/utils/storeLinks.ts`
- Modify: `server/src/controllers/publicProfile.ts` (use the extracted helpers)
- Create: `server/src/controllers/posterLanding.ts`
- Modify: `server/src/routes/index.ts`
- Test: `server/src/tests/posterLandingRoutes.test.ts`

**Interfaces:**
- Consumes: `PosterCode` (Task 1), `shouldCountPosterHit` / `detectStorePlatform` (Task 3), `renderPosterLanding` (Task 5), `renderNotFound` from `services/publicProfilePage`, `billingService` from `services/billing/container`.
- Produces:
  - `appleStoreUrl(): string`, `playStoreUrl(): string` in `utils/storeLinks.ts`
  - `getPosterLandingPage(req, res): Promise<void>` and `startFromPoster(req, res): Promise<void>`
  - Routes `GET /p/:code` and `GET /p/:code/start`

The store URLs move into a shared util first so the poster page and the trainer page cannot drift apart on which listing they link to.

- [ ] **Step 1: Write the failing test**

Create `server/src/tests/posterLandingRoutes.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { PosterCode } from "../models/posterCode";
import { resetPosterFloodBuckets } from "../services/posterScanCounting";
import { appleStoreUrl, playStoreUrl } from "../utils/storeLinks";
import { createTestGym } from "./helpers";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36";
const DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

let counter = 0;
const makePoster = async (overrides: Record<string, unknown> = {}) => {
  counter += 1;
  return PosterCode.create({
    code: `scan${counter}${Date.now().toString(36).slice(-4)}`,
    label: "World Class Dorobanți",
    ...overrides,
  });
};

describe("GET /p/:code", () => {
  beforeEach(() => {
    resetPosterFloodBuckets();
  });

  it("serves the page, counts the scan and stamps last_scanned_at", async () => {
    const poster = await makePoster();

    const res = await request(app).get(`/p/${poster.code}`).set("User-Agent", IPHONE_UA);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain("World Class Dorobanți");

    await poster.reload();
    expect(poster.scanCount).toBe(1);
    expect(poster.lastScannedAt).toBeTruthy();
  });

  it("is never cached, since a cached response is a swallowed scan", async () => {
    const poster = await makePoster();

    const res = await request(app).get(`/p/${poster.code}`).set("User-Agent", IPHONE_UA);

    expect(res.headers["cache-control"]).toContain("no-store");
  });

  it("does not count a HEAD request", async () => {
    const poster = await makePoster();

    await request(app).head(`/p/${poster.code}`).set("User-Agent", IPHONE_UA);

    await poster.reload();
    expect(poster.scanCount).toBe(0);
  });

  it("serves a link-preview crawler without counting it", async () => {
    const poster = await makePoster();

    const res = await request(app)
      .get(`/p/${poster.code}`)
      .set("User-Agent", "facebookexternalhit/1.1");

    expect(res.status).toBe(200);
    await poster.reload();
    expect(poster.scanCount).toBe(0);
  });

  it("prefers the linked gym's name over the free-text label", async () => {
    const { gym } = await createTestGym({ name: "Smart Fit Unirii" });
    const poster = await makePoster({ gymId: gym.id, label: "eticheta veche" });

    const res = await request(app).get(`/p/${poster.code}`).set("User-Agent", IPHONE_UA);

    expect(res.text).toContain("Smart Fit Unirii");
    expect(res.text).not.toContain("eticheta veche");
  });

  it("404s an unknown code and a retired one", async () => {
    const retired = await makePoster({ isActive: false });

    expect((await request(app).get("/p/nope404")).status).toBe(404);
    expect((await request(app).get(`/p/${retired.code}`)).status).toBe(404);

    await retired.reload();
    expect(retired.scanCount).toBe(0);
  });
});

describe("GET /p/:code/start", () => {
  beforeEach(() => {
    resetPosterFloodBuckets();
  });

  it("sends an iPhone to the App Store and counts it there", async () => {
    const poster = await makePoster();

    const res = await request(app)
      .get(`/p/${poster.code}/start`)
      .set("User-Agent", IPHONE_UA);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(appleStoreUrl());

    await poster.reload();
    expect(poster.appleClickCount).toBe(1);
    expect(poster.playClickCount).toBe(0);
  });

  it("sends an Android phone to Play and counts it there", async () => {
    const poster = await makePoster();

    const res = await request(app)
      .get(`/p/${poster.code}/start`)
      .set("User-Agent", ANDROID_UA);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(playStoreUrl());

    await poster.reload();
    expect(poster.playClickCount).toBe(1);
    expect(poster.appleClickCount).toBe(0);
  });

  it("redirects a desktop visitor without counting either platform", async () => {
    const poster = await makePoster();

    const res = await request(app)
      .get(`/p/${poster.code}/start`)
      .set("User-Agent", DESKTOP_UA);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(playStoreUrl());

    await poster.reload();
    expect(poster.appleClickCount).toBe(0);
    expect(poster.playClickCount).toBe(0);
  });

  it("redirects rather than erroring on an unknown code", async () => {
    // Someone is standing in a gym. They should never meet an error page.
    const res = await request(app).get("/p/nope404/start").set("User-Agent", IPHONE_UA);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(appleStoreUrl());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- posterLandingRoutes`
Expected: FAIL — `Cannot find module '../utils/storeLinks'`.

- [ ] **Step 3: Extract the store links**

Create `server/src/utils/storeLinks.ts`:

```ts
/**
 * Both store listings, defaulted rather than required: the identifiers are fixed
 * and already documented in docs/force-update.md, and leaving them to env vars
 * meant the download link silently vanished wherever they weren't set.
 *
 * Shared so the public trainer page and the poster landing page cannot drift
 * apart on which listing they send people to.
 */
const DEFAULT_APPLE_STORE_URL = "https://apps.apple.com/app/id6775085258";
const DEFAULT_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.juroctech.frontend";

export const appleStoreUrl = (): string =>
  process.env.PUBLIC_APPLE_STORE_URL?.trim() || DEFAULT_APPLE_STORE_URL;

export const playStoreUrl = (): string =>
  process.env.PUBLIC_PLAY_STORE_URL?.trim() || DEFAULT_PLAY_STORE_URL;
```

Then in `server/src/controllers/publicProfile.ts`: delete the two `DEFAULT_*_STORE_URL` consts and their doc comment, add `import { appleStoreUrl, playStoreUrl } from "../utils/storeLinks";`, and rewrite `pageOptions()` as:

```ts
const pageOptions = (): PageOptions => ({
  // Empty until a consumer domain exists, which makes the renderer omit
  // canonical/og:url rather than emit a relative one.
  baseUrl: publicWebBaseUrl(),
  appleStoreUrl: appleStoreUrl(),
  playStoreUrl: playStoreUrl(),
});
```

- [ ] **Step 4: Write the controller**

Create `server/src/controllers/posterLanding.ts`:

```ts
import { Request, Response } from "express";
import sequelize from "../db";
import { PosterCode } from "../models/posterCode";
import { Gym } from "../models/gym";
import { billingService } from "../services/billing/container";
import { renderPosterLanding } from "../services/posterLandingPage";
import { renderNotFound, PageOptions } from "../services/publicProfilePage";
import {
  detectStorePlatform,
  shouldCountPosterHit,
} from "../services/posterScanCounting";
import { appleStoreUrl, playStoreUrl } from "../utils/storeLinks";
import { publicWebBaseUrl } from "../utils/publicUrl";

/**
 * The QR poster routes: public, unauthenticated HTML, mounted beside /t/:slug
 * for the same reason — browsers fetch them directly and they must keep working
 * if the JSON API surface changes.
 */

const pageOptions = (): PageOptions => ({
  baseUrl: publicWebBaseUrl(),
  appleStoreUrl: appleStoreUrl(),
  playStoreUrl: playStoreUrl(),
});

const findActivePoster = async (code: string): Promise<PosterCode | null> => {
  const trimmed = code.trim().toLowerCase();
  if (!trimmed) return null;

  return PosterCode.findOne({
    where: { code: trimmed, isActive: true },
    include: [{ model: Gym, attributes: ["name"], required: false }],
  });
};

/**
 * One atomic statement, so two people scanning at the same moment cannot read
 * the same value and write it back twice.
 */
const recordScan = async (posterId: number): Promise<void> => {
  await sequelize.query(
    "UPDATE poster_codes SET scan_count = scan_count + 1, last_scanned_at = NOW(), updated_at = NOW() WHERE id = :id",
    { replacements: { id: posterId } }
  );
};

const recordStoreClick = async (
  posterId: number,
  platform: "ios" | "android"
): Promise<void> => {
  // Column comes from a literal ternary, never from the request.
  const column = platform === "ios" ? "apple_click_count" : "play_click_count";
  await sequelize.query(
    `UPDATE poster_codes SET ${column} = ${column} + 1, updated_at = NOW() WHERE id = :id`,
    { replacements: { id: posterId } }
  );
};

export const getPosterLandingPage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const poster = await findActivePoster(String(req.params.code ?? ""));

    if (!poster) {
      res.status(404).type("html").send(renderNotFound(pageOptions()));
      return;
    }

    if (shouldCountPosterHit(req)) {
      await recordScan(poster.id);
    }

    const gymName = poster.gym?.name?.trim() ?? poster.label;

    // Never cached: this response increments a counter, and a proxy serving it
    // from cache is a scan that never reaches the database.
    res.set("Cache-Control", "no-store");
    res.type("html").send(
      renderPosterLanding({
        gymName: gymName || null,
        gymLogoUrl: poster.gymLogoUrl ?? null,
        startUrl: `/p/${encodeURIComponent(poster.code)}/start`,
        // Same source as the in-app founding-offer banner, so the poster page
        // and the app can never advertise different terms.
        offer: billingService.getFoundingGrantOffer(),
      })
    );
  } catch (error) {
    console.error("[POSTER] landing page failed:", error);
    res.status(500).type("html").send(renderNotFound(pageOptions()));
  }
};

export const startFromPoster = async (req: Request, res: Response): Promise<void> => {
  const platform = detectStorePlatform(
    typeof req.headers["user-agent"] === "string"
      ? req.headers["user-agent"]
      : undefined
  );
  const destination = platform === "ios" ? appleStoreUrl() : playStoreUrl();

  try {
    const poster = await findActivePoster(String(req.params.code ?? ""));

    if (poster && platform !== "unknown" && shouldCountPosterHit(req)) {
      await recordStoreClick(poster.id, platform);
    }
  } catch (error) {
    // A counter failure must never strand someone between a poster and the app.
    console.error("[POSTER] store click failed:", error);
  }

  res.set("Cache-Control", "no-store");
  res.redirect(302, destination);
};
```

- [ ] **Step 5: Mount the routes**

In `server/src/routes/index.ts`, add the import beside `getPublicTrainerPage`:

```ts
import {
  getPosterLandingPage,
  startFromPoster,
} from "../controllers/posterLanding";
```

and register the routes immediately after the `/t/:slug` route, keeping the more specific path first:

```ts
// Gym poster QR codes. Public HTML like /t/:slug, and counted — see
// docs/superpowers/specs/2026-09-18-poster-qr-scan-counter-design.md.
router.get("/p/:code/start", startFromPoster);
router.get("/p/:code", getPosterLandingPage);
```

- [ ] **Step 6: Expose /p/ through nginx**

`server/nginx/conf.d/salvio-web.conf` deliberately exposes only `location /t/` and
ends with `location / { return 404; }`, so the poster URL would 404 on
`salvio.juroc.tech` with the code shipped and working. Add a `/p/` block to the
HTTPS server, immediately after the `location /t/` block, mirroring it exactly:

```nginx
    # Gym poster QR codes. Same treatment as /t/: public GET-only HTML on this
    # host, while the rest of the API stays on api.juroc.tech.
    location /p/ {
        proxy_pass http://$trainee_app$request_uri;
        proxy_http_version 1.1;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 60s;
    }
```

`X-Forwarded-For` matters here beyond convention: `shouldCountPosterHit` reads the
client IP from that header for its flood guard, and without it every scan on the
host would share nginx's own address and trip the limit.

Also update the file's header comment, which currently reads "Only /t/ is exposed
here", to name both paths.

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd server && npm test -- posterLandingRoutes`
Expected: PASS, 10 tests.

Then confirm the extraction broke nothing on the trainer page:

Run: `cd server && npm test -- publicProfile trainer`
Expected: PASS, no new failures.

- [ ] **Step 8: Typecheck and commit**

```bash
cd server && npm run typecheck
git add src/utils/storeLinks.ts src/controllers/publicProfile.ts src/controllers/posterLanding.ts src/routes/index.ts src/tests/posterLandingRoutes.test.ts nginx/conf.d/salvio-web.conf
git commit -m "feat(poster): serve and count /p/:code scans and CTA clicks"
```

---

### Task 7: Admin API for creating and reading codes

**Files:**
- Modify: `server/src/middleware/validation.ts` (append validators)
- Create: `server/src/controllers/posterCodes.ts`
- Create: `server/src/routes/posterCodes.ts`
- Modify: `server/src/routes/index.ts` (mount)
- Test: `server/src/tests/posterCodeAdmin.test.ts`

**Interfaces:**
- Consumes: `PosterCode` (Task 1), `generatePosterCode` / `POSTER_CODE_PATTERN` (Task 2), `publicWebBaseUrl` from `utils/publicUrl`, `authenticate`, `requireAdmin`, `handleValidationErrors`.
- Produces: `createPosterCode`, `listPosterCodes`, `updatePosterCode` controllers, and routes `POST /poster-codes`, `GET /poster-codes`, `PATCH /poster-codes/:id`.

- [ ] **Step 1: Write the failing test**

Create `server/src/tests/posterCodeAdmin.test.ts`:

```ts
import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { PosterCode } from "../models/posterCode";
import { createTestUser } from "./helpers";

const adminToken = async (): Promise<string> =>
  (await createTestUser({ role: "admin" })).token;

describe("POST /poster-codes", () => {
  it("creates a code, generating one when none is supplied", async () => {
    const token = await adminToken();

    const res = await request(app)
      .post("/poster-codes")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "World Class Dorobanți" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toMatch(/^[a-z0-9]{6}$/);
    expect(res.body.data.scanCount).toBe(0);
    expect(res.body.data.url).toContain(`/p/${res.body.data.code}`);
  });

  it("accepts a hand-written code and rejects a malformed one", async () => {
    const token = await adminToken();

    const ok = await request(app)
      .post("/poster-codes")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "Sala Veche", code: "wc-dorobanti" });
    expect(ok.status).toBe(201);
    expect(ok.body.data.code).toBe("wc-dorobanti");

    const bad = await request(app)
      .post("/poster-codes")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "Sala Veche", code: "Has Upper" });
    expect(bad.status).toBe(400);
  });

  it("rejects a duplicate code with 409 rather than a 500", async () => {
    const token = await adminToken();
    await PosterCode.create({ code: "taken1", label: "Sala A" });

    const res = await request(app)
      .post("/poster-codes")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "Sala B", code: "taken1" });

    expect(res.status).toBe(409);
  });
});

describe("GET /poster-codes", () => {
  it("lists codes with their counters, busiest first", async () => {
    const token = await adminToken();
    await PosterCode.create({ code: "quiet1", label: "Sala Liniștită", scanCount: 2 });
    await PosterCode.create({ code: "busy01", label: "Sala Plină", scanCount: 99 });

    const res = await request(app)
      .get("/poster-codes")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const codes = res.body.data.map((row: { code: string }) => row.code);
    expect(codes.indexOf("busy01")).toBeLessThan(codes.indexOf("quiet1"));
    expect(res.body.data[0]).toHaveProperty("appleClickCount");
    expect(res.body.data[0]).toHaveProperty("lastScannedAt");
    expect(res.body.data[0]).toHaveProperty("url");
  });
});

describe("PATCH /poster-codes/:id", () => {
  it("retires a poster so its URL stops resolving but its counts survive", async () => {
    const token = await adminToken();
    const poster = await PosterCode.create({
      code: "retire",
      label: "Sala Închisă",
      scanCount: 41,
    });

    const res = await request(app)
      .patch(`/poster-codes/${poster.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);

    await poster.reload();
    expect(poster.isActive).toBe(false);
    expect(poster.scanCount).toBe(41);
    expect((await request(app).get(`/p/${poster.code}`)).status).toBe(404);
  });
});

describe("poster code admin authorization", () => {
  it("refuses a non-admin on every route", async () => {
    const { token } = await createTestUser({ role: "client" });
    const poster = await PosterCode.create({ code: "guard1", label: "Sala" });

    expect(
      (
        await request(app)
          .post("/poster-codes")
          .set("Authorization", `Bearer ${token}`)
          .send({ label: "Sala" })
      ).status
    ).toBe(403);

    expect(
      (await request(app).get("/poster-codes").set("Authorization", `Bearer ${token}`))
        .status
    ).toBe(403);

    expect(
      (
        await request(app)
          .patch(`/poster-codes/${poster.id}`)
          .set("Authorization", `Bearer ${token}`)
          .send({ isActive: false })
      ).status
    ).toBe(403);
  });

  it("refuses an unauthenticated caller", async () => {
    expect((await request(app).get("/poster-codes")).status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- posterCodeAdmin`
Expected: FAIL — every request 404s, because `/poster-codes` is not mounted.

- [ ] **Step 3: Add the validators**

Append to `server/src/middleware/validation.ts` (`body` and `param` are already imported at the top of the file):

```ts
export const createPosterCodeValidation = [
  body("label")
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("Label must be between 2 and 120 characters."),
  body("code")
    .optional()
    .trim()
    .matches(/^[a-z0-9-]{3,32}$/)
    .withMessage("Code must be 3-32 lowercase letters, digits or hyphens."),
  body("gymId")
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage("gymId must be a positive integer."),
  body("gymLogoUrl")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("gymLogoUrl must be at most 500 characters.")
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("gymLogoUrl must be an http(s) URL."),
];

export const updatePosterCodeValidation = [
  param("id").isInt({ min: 1 }).withMessage("id must be a positive integer."),
  body("label")
    .optional()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("Label must be between 2 and 120 characters."),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean."),
  body("gymLogoUrl")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("gymLogoUrl must be at most 500 characters.")
    .isURL({ protocols: ["http", "https"], require_protocol: true })
    .withMessage("gymLogoUrl must be an http(s) URL."),
];
```

- [ ] **Step 4: Write the controller**

Create `server/src/controllers/posterCodes.ts`:

```ts
import { Request, Response } from "express";
import { UniqueConstraintError } from "sequelize";
import { PosterCode } from "../models/posterCode";
import { generatePosterCode } from "../utils/posterCode";
import { publicWebBaseUrl } from "../utils/publicUrl";
import { sendError, sendSuccess } from "../utils/response";

/** Admin-only management of the printed poster codes. */

/**
 * The URL that goes into the QR generator. Built here rather than in the client
 * so moving PUBLIC_WEB_URL moves every future poster without a code change.
 */
const posterUrl = (code: string): string => {
  const base = publicWebBaseUrl();
  return base ? `${base}/p/${code}` : `/p/${code}`;
};

const serialize = (poster: PosterCode) => ({
  id: poster.id,
  code: poster.code,
  label: poster.label,
  gymId: poster.gymId ?? null,
  gymLogoUrl: poster.gymLogoUrl ?? null,
  scanCount: poster.scanCount,
  appleClickCount: poster.appleClickCount,
  playClickCount: poster.playClickCount,
  lastScannedAt: poster.lastScannedAt ?? null,
  isActive: poster.isActive,
  url: posterUrl(poster.code),
});

export const createPosterCode = async (req: Request, res: Response) => {
  const label = String(req.body.label).trim();
  const requestedCode =
    typeof req.body.code === "string" ? req.body.code.trim().toLowerCase() : null;
  const gymId = req.body.gymId != null ? Number(req.body.gymId) : null;
  const gymLogoUrl =
    typeof req.body.gymLogoUrl === "string" ? req.body.gymLogoUrl.trim() : null;

  // A generated code can collide; retry a couple of times before giving up. A
  // code the admin chose is theirs to fix, so it is never retried.
  const attempts = requestedCode ? 1 : 3;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const code = requestedCode ?? generatePosterCode();

    try {
      const poster = await PosterCode.create({ code, label, gymId, gymLogoUrl });
      return sendSuccess(res, 201, "Poster code created", serialize(poster));
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        if (requestedCode) {
          return sendError(res, 409, "That code is already in use.");
        }
        continue;
      }

      console.error("[POSTER] create failed:", error);
      return sendError(res, 500, "Could not create the poster code.");
    }
  }

  return sendError(res, 500, "Could not allocate a unique poster code.");
};

export const listPosterCodes = async (_req: Request, res: Response) => {
  try {
    const posters = await PosterCode.findAll({
      order: [
        ["scanCount", "DESC"],
        ["id", "DESC"],
      ],
    });

    return sendSuccess(res, 200, "Poster codes retrieved", posters.map(serialize));
  } catch (error) {
    console.error("[POSTER] list failed:", error);
    return sendError(res, 500, "Could not list the poster codes.");
  }
};

export const updatePosterCode = async (req: Request, res: Response) => {
  try {
    const poster = await PosterCode.findByPk(Number(req.params.id));

    if (!poster) {
      return sendError(res, 404, "Poster code not found.");
    }

    if (typeof req.body.label === "string") {
      poster.label = req.body.label.trim();
    }
    if (typeof req.body.isActive === "boolean") {
      poster.isActive = req.body.isActive;
    }
    if (req.body.gymLogoUrl !== undefined) {
      poster.gymLogoUrl =
        typeof req.body.gymLogoUrl === "string" ? req.body.gymLogoUrl.trim() : null;
    }

    await poster.save();

    return sendSuccess(res, 200, "Poster code updated", serialize(poster));
  } catch (error) {
    console.error("[POSTER] update failed:", error);
    return sendError(res, 500, "Could not update the poster code.");
  }
};
```

- [ ] **Step 5: Write the router and mount it**

Create `server/src/routes/posterCodes.ts`:

```ts
import express from "express";
import {
  createPosterCode,
  listPosterCodes,
  updatePosterCode,
} from "../controllers/posterCodes";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/authorization";
import {
  createPosterCodeValidation,
  handleValidationErrors,
  updatePosterCodeValidation,
} from "../middleware/validation";

const router = express.Router();

router.use(authenticate);
router.use(requireAdmin);

router.post("/", createPosterCodeValidation, handleValidationErrors, createPosterCode);
router.get("/", listPosterCodes);
router.patch(
  "/:id",
  updatePosterCodeValidation,
  handleValidationErrors,
  updatePosterCode
);

export default router;
```

In `server/src/routes/index.ts`, add `import posterCodesRouter from "./posterCodes";` with the other router imports, and mount it beside the rest:

```ts
router.use("/poster-codes", posterCodesRouter);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd server && npm test -- posterCodeAdmin`
Expected: PASS, 6 tests.

- [ ] **Step 7: Run the whole poster suite and typecheck**

```bash
cd server && npm test -- poster && npm run typecheck
```

Expected: PASS across `posterCodeModel`, `posterCodeGenerator`, `posterScanCounting`, `posterLandingAssets`, `posterLandingPage`, `posterLandingRoutes`, `posterCodeAdmin`; typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add src/middleware/validation.ts src/controllers/posterCodes.ts src/routes/posterCodes.ts src/routes/index.ts src/tests/posterCodeAdmin.test.ts
git commit -m "feat(poster): add admin endpoints for poster codes"
```

---

## Deployment

Not a code task, but the feature is inert without it. After merging, on each environment:

```bash
cd ~/Trainee && git pull && cd server
docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" < migrations/005_add_poster_codes.sql
docker compose up -d --build app      # or app-dev on the dev host

# The /p/ location block is new. Test the config before reloading: a reload of a
# bad config leaves the running nginx up, a restart does not.
docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload
```

There is nothing to deploy to a separate website. The page is served by this
Express app, exactly like `/t/:slug` — nginx on `salvio.juroc.tech` proxies both
paths to the same `app` container, and everything else on that host still 404s.

Then create the first code and read back the URL to encode:

```bash
curl -s -X POST https://<host>/poster-codes \
  -H "Authorization: Bearer <admin token>" \
  -H "Content-Type: application/json" \
  -d '{"label":"World Class Dorobanți"}'
```

`PUBLIC_WEB_URL` must be set on the server for the returned `url` to be absolute; without it the response carries a relative `/p/<code>` and the QR would be unusable.
