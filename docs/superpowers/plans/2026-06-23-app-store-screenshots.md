# App Store & Google Play Screenshots — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the Romanian-language store screenshot set (6 core frames + optional map) for the Apple App Store and Google Play, following the trust-and-choice narrative in the design spec.

**Architecture:** One reproducible demo-data seed stages the in-app content; raw screenshots are captured in Romanian on a 6.7″ iPhone and a 13″ iPad; a single Figma template renders the caption-top gradient treatment; each frame is exported per target size and committed under `store-assets/`; finally the sets are uploaded to App Store Connect and Google Play (RO locale).

**Tech Stack:** TypeScript seed via `ts-node` + sequelize-typescript (existing `server/src/seeds` pattern); the running Expo app (RO language) for capture; Figma for framing/export; App Store Connect + Google Play Console for upload.

**Spec:** `docs/superpowers/specs/2026-06-23-app-store-screenshots-design.md`

## Global Constraints

- **Listing language:** Romanian only. App captured with language set to RO; all captions in Romanian.
- **Brand gradient:** `#10B981` (top) → `#059669` (bottom), vertical — identical on every frame.
- **Master canvas:** iPhone 6.7″ = **1290 × 2796 px**. Design all frames here first.
- **iPad canvas:** 13″ = **2048 × 2732 px** (required because `app.json` has `supportsTablet: true`).
- **Google Play phone:** **1080 × 1920 px** (9:16). **Feature graphic:** **1024 × 500 px**.
- **Frame order (fixed):** 1 Find → 2 Trust → 3 Filter → 4 Pricing → 5 Schedule → 6 CTA (→ 7 Map optional). Frames 1–3 are the strongest (shown in search).
- **Frame 6 (Welcome) exception:** rendered full-bleed (screenshot fills frame) with caption on a scrim — no gradient border.
- **Quality bar:** trainer ratings 4.7–5.0★, real-looking portrait photos (no placeholder avatars), clean status bar (Apple 9:41 convention).
- **Exact RO captions** (headline / subhead):
  1. `Găsește antrenorul perfect` / `Antrenori verificați, lângă tine`
  2. `Verificați. Recenzați. De încredere.` / `Vezi recenzii reale înainte să alegi`
  3. `Caută după obiectiv și preț` / `Filtrează exact ce cauți`
  4. `Prețuri clare, fără surprize` / `Alege pachetul potrivit ție`
  5. `Programează-ți ședințele` / `Urmărește-ți fiecare antrenament`
  6. `Începe astăzi` / `Următoarea ședință, la o atingere`
  7. `Antrenori chiar lângă tine` / `Găsește ședințe în zona ta`
- **Asset folder layout (created in Task 1):**
  ```
  store-assets/
    raw/            # unframed screenshots straight from the device
    final/ios-6.7/  # 1290×2796
    final/ipad-13/  # 2048×2732
    final/play-phone/   # 1080×1920
    final/play-feature-graphic.png  # 1024×500
  ```
- **Production tool:** Figma (free, exact pixel export). Faster alternative if preferred: AppMockUp Studio — same layout decisions apply.

---

### Task 1: Asset folder scaffold + prerequisite seeds

**Files:**
- Create: `store-assets/.gitkeep`, `store-assets/raw/.gitkeep`, `store-assets/final/ios-6.7/.gitkeep`, `store-assets/final/ipad-13/.gitkeep`, `store-assets/final/play-phone/.gitkeep`

**Interfaces:**
- Produces: the `store-assets/` directory tree that every later export task writes into; a seeded `specializations` table and gym rows that Task 2 depends on.

- [ ] **Step 1: Create the asset folder tree**

```bash
mkdir -p store-assets/raw store-assets/final/ios-6.7 store-assets/final/ipad-13 store-assets/final/play-phone
touch store-assets/.gitkeep store-assets/raw/.gitkeep store-assets/final/ios-6.7/.gitkeep store-assets/final/ipad-13/.gitkeep store-assets/final/play-phone/.gitkeep
```

- [ ] **Step 2: Ensure specializations and gyms exist (Task 2 references them)**

Run from `server/`:
```bash
cd server
npm run seed:specializations
npm run seed:gyms
```
Expected: both print a success summary and exit 0. Gyms appear in Bucharest (fallback set is fine for the map frame).

- [ ] **Step 3: Verify**

```bash
docker exec 08c743862f29 psql -U admin -d trainee -c "SELECT count(*) FROM specializations;"
docker exec 08c743862f29 psql -U admin -d trainee -c "SELECT count(*) FROM gyms;"
```
Expected: both counts > 0.

- [ ] **Step 4: Commit**

```bash
git add store-assets/.gitkeep store-assets/raw/.gitkeep store-assets/final
git commit -m "chore: scaffold store-assets folder tree for screenshots"
```

---

### Task 2: Demo-data seed (trainers, packages, reviews, gym links)

Stages the content for frames 1–4 and 7 in one reproducible script. Frame 5 (schedule) and the flagship gallery are staged via the app UI in Task 3 because they go through interactive/S3 flows.

**Files:**
- Create: `server/src/seeds/demoScreenshotSeed.ts`
- Test: `server/src/seeds/demoScreenshotSeed.verify.ts` (a throwaway query script run once)

**Interfaces:**
- Consumes: existing models `User`, `Trainer`, `Specialization`, `TrainerPackage`, `Review`, `TrainerGym`, `Gym`; bootstrap helpers `ensureDatabaseExtensions`, `ensureSpatialAndSearchInfrastructure`.
- Produces: 5 trainer profiles (flagship = `andrei.popescu.demo@trainee.app`, `subscriptionStatus: "active"`, `isFeatured: true`), 3 demo client users, 3 RO text reviews on the flagship, 3 packages on the flagship, gym links for all trainers, and polished `totalRating`/`reviewCount` values on every demo trainer.

- [ ] **Step 1: Write the seed script**

Create `server/src/seeds/demoScreenshotSeed.ts`:

```ts
// server/src/seeds/demoScreenshotSeed.ts
// Run with: npx ts-node src/seeds/demoScreenshotSeed.ts
// Idempotent: re-running updates the same demo rows (matched by email).
import sequelize from "../db";
import { User } from "../models/user";
import { Trainer } from "../models/trainer";
import { Specialization } from "../models/specialization";
import { TrainerPackage } from "../models/trainerPackage";
import { Review } from "../models/review";
import { TrainerGym } from "../models/trainerGym";
import { Gym } from "../models/gym";
import {
  ensureDatabaseExtensions,
  ensureSpatialAndSearchInfrastructure,
} from "../services/databaseBootstrap";

const portrait = (g: "men" | "women", n: number) =>
  `https://randomuser.me/api/portraits/${g}/${n}.jpg`;

type DemoTrainer = {
  email: string;
  firstName: string;
  lastName: string;
  photo: string;
  sex: "male" | "female";
  bio: string;
  experienceYears: number;
  hourlyRate: number;
  sessionRate: number;
  city: string;
  state: string;
  rating: number;     // shown on card (4.7–5.0)
  reviewCount: number; // shown on card
  featured: boolean;
};

const DEMO_TRAINERS: DemoTrainer[] = [
  {
    email: "andrei.popescu.demo@trainee.app",
    firstName: "Andrei", lastName: "Popescu", sex: "male", photo: portrait("men", 32),
    bio: "Antrenor de forță și hipertrofie. Te ajut să construiești mușchi și să ridici corect, în siguranță.",
    experienceYears: 8, hourlyRate: 120, sessionRate: 40,
    city: "București", state: "Ilfov", rating: 4.9, reviewCount: 42, featured: true,
  },
  {
    email: "maria.ionescu.demo@trainee.app",
    firstName: "Maria", lastName: "Ionescu", sex: "female", photo: portrait("women", 44),
    bio: "Fitness funcțional și nutriție. Programe personalizate pentru energie și echilibru.",
    experienceYears: 6, hourlyRate: 110, sessionRate: 45,
    city: "București", state: "Ilfov", rating: 5.0, reviewCount: 28, featured: false,
  },
  {
    email: "elena.dumitru.demo@trainee.app",
    firstName: "Elena", lastName: "Dumitru", sex: "female", photo: portrait("women", 68),
    bio: "Yoga și mobilitate. Recâștigă-ți flexibilitatea și scapă de tensiune.",
    experienceYears: 5, hourlyRate: 95, sessionRate: 38,
    city: "Cluj-Napoca", state: "Cluj", rating: 4.8, reviewCount: 31, featured: false,
  },
  {
    email: "cristian.stan.demo@trainee.app",
    firstName: "Cristian", lastName: "Stan", sex: "male", photo: portrait("men", 51),
    bio: "CrossFit și condiție fizică. Antrenamente intense, rezultate vizibile.",
    experienceYears: 7, hourlyRate: 115, sessionRate: 42,
    city: "Timișoara", state: "Timiș", rating: 4.7, reviewCount: 19, featured: false,
  },
  {
    email: "alexandru.radu.demo@trainee.app",
    firstName: "Alexandru", lastName: "Radu", sex: "male", photo: portrait("men", 12),
    bio: "Slăbire și cardio. Te aduc în cea mai bună formă a ta, pas cu pas.",
    experienceYears: 4, hourlyRate: 90, sessionRate: 35,
    city: "București", state: "Ilfov", rating: 4.9, reviewCount: 23, featured: false,
  },
];

const DEMO_CLIENTS = [
  { email: "client1.demo@trainee.app", firstName: "Ioana", lastName: "Marin", sex: "female" as const, photo: portrait("women", 21) },
  { email: "client2.demo@trainee.app", firstName: "Vlad", lastName: "Georgescu", sex: "male" as const, photo: portrait("men", 5) },
  { email: "client3.demo@trainee.app", firstName: "Diana", lastName: "Petre", sex: "female" as const, photo: portrait("women", 9) },
];

// Reviews shown on the flagship trainer detail (frame 2). review_text must be 10–100 chars.
const FLAGSHIP_REVIEWS = [
  { rating: 5, text: "Cel mai bun antrenor cu care am lucrat. Rezultate reale în 3 luni!" },
  { rating: 5, text: "Profesionist, atent și mereu punctual. Recomand cu încredere." },
  { rating: 4, text: "Ședințe bine structurate, am învățat tehnica corectă de la zero." },
];

// Packages on the flagship (frame 4). Lowest per-session = 800/20 = 40 → matches sessionRate.
const FLAGSHIP_PACKAGES = [
  { name: "Start", price: 250, sessionCount: 5, sortOrder: 0 },
  { name: "Popular", price: 450, sessionCount: 10, sortOrder: 1 },
  { name: "Pro", price: 800, sessionCount: 20, sortOrder: 2 },
];

async function upsertUser(args: {
  email: string; firstName: string; lastName: string; role: "trainer" | "client";
  sex: "male" | "female"; photo: string;
}): Promise<User> {
  const [user] = await User.findOrCreate({
    where: { email: args.email },
    defaults: {
      email: args.email,
      password: "DemoPass123!", // hashed by the User beforeCreate hook
      firstName: args.firstName,
      lastName: args.lastName,
      role: args.role,
      sex: args.sex,
      profileImageUrl: args.photo,
      isVerified: true,
      isActive: true,
    } as any,
  });
  // keep photo/name fresh on re-runs
  await user.update({ firstName: args.firstName, lastName: args.lastName, profileImageUrl: args.photo });
  return user;
}

async function seed() {
  try {
    await sequelize.authenticate();
    console.log("✅ DB connected");
    await ensureDatabaseExtensions();
    await sequelize.sync({ alter: true });
    await ensureSpatialAndSearchInfrastructure();
    console.log("✅ Models synced");

    const specs = await Specialization.findAll();
    if (specs.length === 0) {
      throw new Error("No specializations found — run `npm run seed:specializations` first (Task 1).");
    }
    const gyms = await Gym.findAll({ limit: 5 });
    if (gyms.length === 0) {
      throw new Error("No gyms found — run `npm run seed:gyms` first (Task 1).");
    }

    // demo clients (for reviews)
    const clientUsers: User[] = [];
    for (const c of DEMO_CLIENTS) {
      clientUsers.push(await upsertUser({ ...c, role: "client" }));
    }

    let flagshipTrainerId: number | null = null;

    for (let i = 0; i < DEMO_TRAINERS.length; i++) {
      const d = DEMO_TRAINERS[i];
      const user = await upsertUser({
        email: d.email, firstName: d.firstName, lastName: d.lastName,
        role: "trainer", sex: d.sex, photo: d.photo,
      });

      const [trainer] = await Trainer.findOrCreate({
        where: { userId: user.id },
        defaults: {
          userId: user.id,
          bio: d.bio,
          experienceYears: d.experienceYears,
          hourlyRate: d.hourlyRate,
          sessionRate: d.sessionRate,
          locationCity: d.city,
          locationState: d.state,
          locationCountry: "Romania",
          isAvailable: true,
          isFeatured: d.featured,
          subscriptionStatus: "active", // ensures it shows in search
          billingProvider: "none",
        } as any,
      });
      await trainer.update({
        bio: d.bio, experienceYears: d.experienceYears, hourlyRate: d.hourlyRate,
        sessionRate: d.sessionRate, locationCity: d.city, locationState: d.state,
        locationCountry: "Romania", isAvailable: true, isFeatured: d.featured,
        subscriptionStatus: "active", billingProvider: "none",
      } as any);

      // assign 2 specializations
      const chosen = [specs[i % specs.length], specs[(i + 1) % specs.length]];
      await (trainer as any).$set("specializations", chosen);

      // link to 2 gyms (for the map frame)
      await TrainerGym.destroy({ where: { trainerId: trainer.id } });
      for (const g of gyms.slice(0, 2)) {
        await TrainerGym.create({ trainerId: trainer.id, gymId: g.id, isAvailable: true } as any);
      }

      if (d.featured) {
        flagshipTrainerId = trainer.id;

        // packages (frame 4)
        await TrainerPackage.destroy({ where: { trainerId: trainer.id } });
        for (const p of FLAGSHIP_PACKAGES) {
          await TrainerPackage.create({ trainerId: trainer.id, ...p } as any);
        }

        // text reviews (frame 2) — triggers rating recompute via Review hook
        await Review.destroy({ where: { trainerId: trainer.id } });
        for (let r = 0; r < FLAGSHIP_REVIEWS.length; r++) {
          await Review.create({
            trainerId: trainer.id,
            clientId: clientUsers[r % clientUsers.length].id,
            rating: FLAGSHIP_REVIEWS[r].rating,
            reviewText: FLAGSHIP_REVIEWS[r].text,
            isVerified: true,
          } as any);
        }
      }

      // Override rating/count for a polished card look (set AFTER reviews so the
      // Review hook doesn't clobber it). Persists because Trainer has no rating hook.
      await trainer.update({ totalRating: d.rating, reviewCount: d.reviewCount });
      console.log(`✅ Trainer ready: ${d.firstName} ${d.lastName} (id=${trainer.id})`);
    }

    console.log(`✅ Demo seed complete. Flagship trainer id = ${flagshipTrainerId}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Demo seed failed:", error);
    process.exit(1);
  }
}

seed();
```

- [ ] **Step 2: Add the npm script**

In `server/package.json`, add to `"scripts"`:
```json
"seed:demo": "ts-node src/seeds/demoScreenshotSeed.ts"
```

- [ ] **Step 3: Run the seed**

```bash
cd server
npm run seed:demo
```
Expected: prints `✅ Trainer ready:` five times and `✅ Demo seed complete. Flagship trainer id = <N>`, exits 0.

- [ ] **Step 4: Verify the data is correct**

```bash
docker exec 08c743862f29 psql -U admin -d trainee -c "SELECT t.id, u.first_name, u.last_name, t.total_rating, t.review_count, t.session_rate, t.is_featured FROM trainer_profiles t JOIN users u ON u.id=t.user_id WHERE u.email LIKE '%.demo@trainee.app' ORDER BY t.is_featured DESC;"
docker exec 08c743862f29 psql -U admin -d trainee -c "SELECT name, session_count, price FROM trainer_packages ORDER BY sort_order;"
docker exec 08c743862f29 psql -U admin -d trainee -c "SELECT count(*) FROM reviews WHERE review_text <> '';"
```
Expected: 5 demo trainers (flagship first, rating 4.9, 42 reviews, session_rate 40); 3 packages (Start/Popular/Pro = 250/450/800); review count ≥ 3.

- [ ] **Step 5: Commit**

```bash
git add server/src/seeds/demoScreenshotSeed.ts server/package.json
git commit -m "feat: add demo data seed for store screenshots"
```

---

### Task 3: Stage flagship gallery + schedule, set app to Romanian

Frames 2 and 5 need content that flows through the app's image/scheduling pipelines, so stage them in the running app rather than the seed.

**Files:** none (in-app actions). Prerequisite: server running (`cd server && npm run dev`) and app reaching it (see the earlier dev-server fix — phone uses the PC LAN IP over `http`).

**Interfaces:**
- Consumes: the flagship trainer account `andrei.popescu.demo@trainee.app` / `DemoPass123!` and a demo client account `client1.demo@trainee.app` / `DemoPass123!` from Task 2.

- [ ] **Step 1: Set the app language to Romanian**

In the app: open the profile screen → 3-dots menu → Language → **Română**. Confirm UI strings switch to RO (this is the language all captures use).

- [ ] **Step 2: Upload a gallery for the flagship (frame 2)**

Log in as `andrei.popescu.demo@trainee.app`. Open the trainer profile → edit → image section. Upload **3–4 gym/training photos** (use free-license fitness images, e.g. from Unsplash downloaded to the device). Verify they appear in the gallery grid.

- [ ] **Step 3: Stage an upcoming session + check-in code (frame 5)**

Still as the trainer: open `trainer-schedule`, set a working-hours template for this week, generate slots, open a day with the day planner, and **assign `client1.demo@trainee.app`** to one near-future slot.
Then log in as `client1.demo@trainee.app`: open `my-schedule` and confirm an **upcoming session** is listed and a **check-in code** is visible.

- [ ] **Step 4: Verify (acceptance gate)**

Walk all six screens once in RO and confirm each is screenshot-ready:
- Search results: ≥4 trainers, photos, 4.7–5.0★, prices.
- Flagship detail: bio, specializations, 4.9★, ≥3 reviews, gallery populated.
- Search filters open: specialization + price + location set.
- Flagship packages: Start / Popular / Pro with prices.
- Client my-schedule: upcoming session + check-in code.
- Welcome: renders (no data needed).

No commit (no repo files changed). If any screen is not ready, fix the data (re-run Task 2 seed or redo the relevant in-app step) before proceeding.

---

### Task 4: Capture raw Romanian screenshots (iPhone 6.7″ + iPad 13″)

**Files:**
- Create: `store-assets/raw/iphone/01-search.png … 06-welcome.png` (+ `07-map.png` optional)
- Create: `store-assets/raw/ipad/01-search.png … 06-welcome.png` (+ `07-map.png` optional)

**Interfaces:**
- Consumes: the RO-staged app from Task 3.
- Produces: 6–7 raw PNGs per device that Tasks 5–7 frame. Filenames encode the fixed order.

- [ ] **Step 1: Capture the iPhone set**

On a 6.7″-class device or the iOS Simulator (iPhone 15/16 Pro Max), with the app in RO and a clean status bar, capture each screen in order:
1. Search results (scrolled to top, a city in the field) → `01-search.png`
2. Flagship trainer detail (reviews + gallery visible) → `02-detail.png`
3. Search with the filter panel open → `03-filters.png`
4. Flagship packages section → `04-packages.png`
5. Client my-schedule (upcoming + check-in code) → `05-schedule.png`
6. Welcome screen → `06-welcome.png`
7. *(optional)* Gym map with markers → `07-map.png`

Save into `store-assets/raw/iphone/`.

- [ ] **Step 2: Capture the iPad set**

Repeat on a 13″ iPad (or iPad Pro simulator), same screens and filenames, into `store-assets/raw/ipad/`.

- [ ] **Step 3: Verify dimensions**

```bash
cd store-assets/raw
for f in iphone/*.png; do echo "$f"; magick identify -format "%wx%h\n" "$f"; done
```
Expected: iPhone shots are 1290×2796 (or the simulator's native 6.7″ size); iPad shots are 2048×2732-class. (If ImageMagick isn't installed, check dimensions in Finder/Explorer file info.)

- [ ] **Step 4: Commit**

```bash
git add store-assets/raw
git commit -m "chore: add raw RO screenshots (iPhone 6.7 + iPad 13)"
```

---

### Task 5: Build the Figma framing template

**Files:**
- Create: Figma file `Trainee Store Screenshots` (not in git; export targets are committed in later tasks)

**Interfaces:**
- Produces: a reusable 1290×2796 frame component (gradient + caption block + device mockup slot) used to compose every iPhone frame in Task 6, and copied/relaid-out for iPad in Task 6b.

- [ ] **Step 1: Create the master frame**

New Figma frame, **1290 × 2796**. Add a vertical linear gradient fill from `#10B981` (top) to `#059669` (bottom).

- [ ] **Step 2: Add the caption block**

Top ~25% of the frame: a headline text layer (bold, ~72 px, white) and a subhead text layer (~40 px, white, 85% opacity), left/centered consistently. Name the layers `headline` and `subhead` so they're easy to swap per frame.

- [ ] **Step 3: Add the device slot**

Place an iPhone device frame mockup (Figma community "Apple Devices" / "Mockups" plugin, or Apple's Design Resources) below the caption. Add an image fill placeholder where the raw screenshot goes. Group as a component named `device`.

- [ ] **Step 4: Verify**

Confirm the frame exports at exactly 1290×2796 (Export → PNG → 1x) and that swapping the `headline`/`subhead` text and the `device` image fill updates cleanly. No commit (Figma file is external).

---

### Task 6: Compose & export the iPhone 6.7″ set

**Files:**
- Create: `store-assets/final/ios-6.7/01-search.png … 06-welcome.png` (+ `07-map.png` optional)

**Interfaces:**
- Consumes: Task 5 template; Task 4 `store-assets/raw/iphone/*` images; the exact RO captions from Global Constraints.
- Produces: the finished App Store iPhone set at 1290×2796.

- [ ] **Step 1: Compose frames 1–5 and 7**

Duplicate the master frame once per screenshot. For each, set the `device` image fill to the matching raw iPhone PNG and set `headline`/`subhead` to the exact RO captions (frame N ↔ caption N from Global Constraints).

- [ ] **Step 2: Compose frame 6 full-bleed (the exception)**

For `06-welcome`: do **not** use the gradient/device frame. Place the raw `06-welcome.png` full-bleed in a 1290×2796 frame, add a subtle dark scrim at the top, and overlay caption 6 (`Începe astăzi` / `Următoarea ședință, la o atingere`) in white.

- [ ] **Step 3: Export at 1290×2796**

Export each composed frame as PNG (1x) into `store-assets/final/ios-6.7/` using the order-encoded filenames.

- [ ] **Step 4: Verify**

```bash
cd store-assets/final/ios-6.7
for f in *.png; do echo -n "$f "; magick identify -format "%wx%h\n" "$f"; done
```
Expected: every file is exactly **1290×2796**. Eyeball that captions match the spec strings (Romanian, correct frame order) and frame 6 is full-bleed.

- [ ] **Step 5: Commit**

```bash
git add store-assets/final/ios-6.7
git commit -m "feat: add final App Store iPhone 6.7 screenshot set (RO)"
```

---

### Task 6b: Re-lay-out & export the iPad 13″ set

**Files:**
- Create: `store-assets/final/ipad-13/01-search.png … 06-welcome.png` (+ `07-map.png` optional)

**Interfaces:**
- Consumes: Task 5 template; Task 4 `store-assets/raw/ipad/*`; exact RO captions.
- Produces: the App Store iPad set at 2048×2732.

- [ ] **Step 1: Re-lay-out for the wider canvas**

Duplicate the template into a **2048 × 2732** frame. Reposition the caption block and device for the wider aspect (do **not** just upscale the phone composition — iPad is less tall, so the device sits larger/centered). Keep gradient, type scale ratios, and caption strings identical.

- [ ] **Step 2: Compose all frames**

Set `device` image fills to the raw **iPad** PNGs; apply captions 1–7. Frame 6 full-bleed as in Task 6.

- [ ] **Step 3: Export + verify**

Export PNGs into `store-assets/final/ipad-13/`, then:
```bash
cd store-assets/final/ipad-13
for f in *.png; do echo -n "$f "; magick identify -format "%wx%h\n" "$f"; done
```
Expected: every file **2048×2732**.

- [ ] **Step 4: Commit**

```bash
git add store-assets/final/ipad-13
git commit -m "feat: add final App Store iPad 13 screenshot set (RO)"
```

---

### Task 7: Export the Google Play phone set + feature graphic

**Files:**
- Create: `store-assets/final/play-phone/01-search.png … 06-welcome.png` (+ `07-map.png` optional)
- Create: `store-assets/final/play-feature-graphic.png`

**Interfaces:**
- Consumes: the Task 6 iPhone compositions (reused — same layout, resized) and the brand gradient/logo for the feature graphic.
- Produces: the Google Play phone set at 1080×1920 and the 1024×500 feature graphic.

- [ ] **Step 1: Export the phone set at 1080×1920**

In Figma, select the Task 6 iPhone frames and export them resized to **1080×1920** (Figma: set export to a fixed width of 1080 via a 1080/1290 ≈ 0.837x scale; or duplicate into 1080×1920 frames and refit). Save into `store-assets/final/play-phone/`.

- [ ] **Step 2: Create the feature graphic (1024×500)**

New 1024×500 frame: brand gradient, the Trainee logo/barbell mark, and the tagline `Găsește antrenorul perfect`. Export as `store-assets/final/play-feature-graphic.png`.

- [ ] **Step 3: Verify**

```bash
cd store-assets/final
for f in play-phone/*.png; do echo -n "$f "; magick identify -format "%wx%h\n" "$f"; done
magick identify -format "%wx%h\n" play-feature-graphic.png
```
Expected: phone files **1080×1920**; feature graphic **1024×500**.

- [ ] **Step 4: Commit**

```bash
git add store-assets/final/play-phone store-assets/final/play-feature-graphic.png
git commit -m "feat: add Google Play phone set + feature graphic (RO)"
```

---

### Task 8: Upload to App Store Connect & Google Play (RO locale)

**Files:** none (store consoles).

**Interfaces:**
- Consumes: `store-assets/final/ios-6.7/`, `store-assets/final/ipad-13/`, `store-assets/final/play-phone/`, `store-assets/final/play-feature-graphic.png`.

- [ ] **Step 1: App Store Connect**

In App Store Connect → your app → the **Romanian (Romania)** localization → App Previews and Screenshots: upload the **6.7″ iPhone** set and the **13″ iPad** set, in the fixed order (1 Find → … → 6 CTA, + 7 Map if used).

- [ ] **Step 2: Google Play Console**

In Play Console → your app → Store listing → **Romanian** localization: upload the **phone** screenshots (2–8) in order and the **feature graphic**.

- [ ] **Step 3: Verify**

In each console's preview, confirm: order is correct, captions are Romanian and legible at thumbnail size, frames 1–3 read well in the search-result preview, and no store validation warnings (especially that the iPad set is present, since `supportsTablet: true`).

- [ ] **Step 4: Done**

No repo commit. The committed `store-assets/final/` tree is the source of truth for re-uploads.

---

## Self-Review

**Spec coverage:**
- Audience/strategy (client, Approach A) → Tasks 2–4 stage and capture the trust-and-choice screens in order. ✓
- Exact RO captions → Global Constraints + applied in Tasks 6/6b/7. ✓
- Visual treatment (caption-top gradient; frame 6 full-bleed) → Tasks 5, 6 (Step 2). ✓
- Per-frame demo data → Task 2 (seed) + Task 3 (gallery/schedule via UI). ✓
- Sizes: iPhone 6.7″, iPad 13″, Play phone, feature graphic → Tasks 6, 6b, 7. ✓
- RO-only localization → Global Constraints + Task 3 Step 1 + Task 8 (RO locale). ✓
- iPad retained per `supportsTablet: true` → Tasks 4/6b/8. ✓
- Demo-dataset prerequisite called out → Tasks 1–2. ✓
- Optional map frame 7 → carried through every task as optional. ✓

**Placeholder scan:** No TBD/TODO; seed code is complete; captions are verbatim; commands have expected output. ImageMagick `magick identify` noted with a Finder/Explorer fallback.

**Type/name consistency:** Seed uses real model attributes verified against `user.ts`, `trainer.ts`, `review.ts`, `trainerPackage.ts` (e.g., `reviewText` 10–100 chars, `sessionCount`, `subscriptionStatus: "active"`, `profileImageUrl` valid URL). Flagship `sessionRate: 40` matches the lowest per-session package (800/20). Filenames encode the fixed frame order consistently across raw → final tasks.

**Known caveats (acceptable for a one-time set):**
- The flagship's `reviewCount` field (42) is set higher than the 3 seeded review rows for a polished card; the detail screen lists the 3 real reviews. If the detail screen derives the count from row count instead of the field, add more review rows in Task 2.
- `TrainerGym` is created with `{ trainerId, gymId, isAvailable }`; if the model uses different attribute names the seed will error on Step 3 — adjust to the model's fields (the map frame is optional regardless).
