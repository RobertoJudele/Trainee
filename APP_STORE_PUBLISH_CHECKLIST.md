# App Store Publishing Checklist — Trainee

Full pre-submission checklist, verified against the actual codebase on 2026-07-03.
Legend: ✅ verified OK today · ⚠️ needs action · ☐ manual step (can't verify from code)

Related existing docs: `APP_STORE_CONNECT_SETUP.md`, `APP_STORE_REVIEW_COMPLIANCE.md`,
`FINAL_PRESUBMISSION_REPORT.md`, `SUBSCRIPTION_IAP_ASSESSMENT.md`, `LEGAL_COMPLIANCE_CHECKLIST.md`,
`TESTFLIGHT_BETA_GUIDE.md`. This file supersedes their status where they conflict — features
added since (session packs, invites, push reminders) are covered here.

---

## 1. Blockers found in today's audit — fix before submitting

- [x] ✅ **Stripe merchant ID placeholder removed** (2026-07-09): plugin config is
  now `["@stripe/stripe-react-native", {}]` — empty props, so no Apple Pay
  entitlement is emitted (SDK still builds; Stripe checkout planned for the future).
  Note: the plugin requires a props *object* — a bare string crashes `expo config`
  with `Cannot read properties of undefined (reading 'merchantIdentifier')`. When
  Stripe ships, add `merchantIdentifier` back with a real ID registered in the portal.
- [x] ✅ **App icon resized to 1024×1024** (2026-07-09), still 24bpp / no alpha.
- [x] ✅ **`expo-notifications` added to `plugins`** in app.json (2026-07-09).
- [x] ✅ **Device ID added to `NSPrivacyCollectedDataTypes`** in app.json
  (2026-07-09). Still manual: mirror it in the App Store Connect privacy nutrition
  labels (Identifiers → Device ID, App Functionality, linked, no tracking) and
  mention push tokens in the privacy policy.
- [x] ✅ **APNs key for Expo push added** (2026-07-09) via `eas credentials` (iOS,
  production profile) — Expo-managed APNs key set up, which also registers the Push
  Notifications capability for `com.juroctech.frontend`. Still verify end-to-end on a
  real build (see §9).
- [x] ✅ **`supportsTablet` set to `false`** (2026-07-09) — iPhone-only for v1, no
  iPad screenshots needed. iPad support can be *added* in a later version but never
  removed once shipped, so this is the safe direction.
- [x] ✅ **EAS iOS build image pinned to `"latest"`** in eas.json production profile
  (2026-07-09) — resolves to Xcode 26+, satisfying the April 2026 upload requirement.
- [~] ⚠️ **Empty marketplace = Guideline 2.1 risk.** A reviewer searching for trainers
  in Cupertino sees zero results. Three mitigations:
  - [x] (a) client + trainer accounts seeded (confirmed 2026-07-09). Verify the
    seeded trainers actually surface in search/map with the reviewer's demo login
    (populated profile photos, schedule, reviews) — empty profiles read as broken.
  - [x] (b) empty states verified 2026-07-09: Search (initial prompt +
    `noTrainersFound` with clear-filters CTA), Map (`noGymsFound`), My Schedule
    (`noUpcomingSessions` + `canGenerateCode`), reviews (`noReviewsYet`). Suggested
    trainers hook exists but is not wired to any screen — no surface, nothing to fix.
  - [ ] (c) explain the geography in the App Review notes ("marketplace launching in
    Cluj-Napoca, Romania — use the demo accounts to see populated data")

## 2. Apple account & agreements

- [ ] ☐ Apple Developer Program membership active
- [ ] ☐ **Paid Applications Agreement** signed in App Store Connect (required for
  subscriptions — IAP products can't go live without it), banking + tax forms complete
- [ ] ☐ App record created: bundle ID `com.juroctech.frontend`, SKU set
- [ ] ☐ D-U-N-S / legal entity name is what should appear as the seller

## 3. Build & technical

- [x] ✅ `ITSAppUsesNonExemptEncryption: false` set (skips export-compliance prompt)
- [x] ✅ New Architecture disabled deliberately (react-native-maps #5877) — allowed,
  not a review issue
- [x] ✅ Foreground-only location (`NSLocationWhenInUseUsageDescription`) — matches
  actual usage (map centering); no background modes claimed
- [ ] ☐ iOS `buildNumber` strategy: rely on EAS `autoIncrement` or set explicitly —
  every upload needs a unique build number
- [ ] ☐ Version `1.0.0` confirmed in app.json
- [ ] ☐ Release build tested on a physical iPhone (not just simulator/Expo Go —
  push reminders and RevenueCat only work in real builds)
- [ ] ☐ No console errors / red screens anywhere; API base URL points at production
- [ ] ☐ App works on the smallest supported iPhone screen (SE-class) — check the
  day planner and checkout scroll

## 4. Icons & visual assets

| Asset | Requirement | Status |
|---|---|---|
| App Store icon | 1024×1024 PNG, **no alpha**, no rounded corners | ⚠️ 1254×1254 (alpha OK) — resize |
| Splash (`splash-icon.png`) | 1024×1024, centered, `contain` on white | ✅ |
| Launch experience | Splash is branding, not an ad, loads fast | ✅ (Expo splash) |
| In-app tab/nav icons | Ionicons — standard, legible | ✅ |

- [ ] ☐ Icon looks correct at small sizes (Settings 29pt, Spotlight 40pt) — test on device
- [ ] ☐ Icon does not include text that becomes unreadable at 29pt

## 5. Writing / copy standards

### Info.plist usage descriptions (reviewer-read, rejection-prone)

Current strings work but have two problems: the phrase **"Your app needs…"** reads
like a template (it's *the user's* phone, *your* app — Apple examples use the app
name), and **"workout photos"** describes a feature that doesn't exist (the app has
profile pictures and trainer gallery/credential photos). Descriptions must match
real functionality.

- [x] ✅ Usage strings rewritten (2026-07-09) to name the app and match real
  features — "workout photos" removed everywhere; camera + photo-library strings
  now describe profile pictures and trainer gallery/credential photos.
- [x] ✅ `NSPhotoLibraryAddOnlyUsageDescription` removed — the app never saves to the
  photo library (no `MediaLibrary`/`saveToLibrary` usage), so declaring it was an
  over-declaration.
- [x] ✅ `expo-image-picker` `photosPermission`/`cameraPermission` mirror the
  infoPlist strings (the plugin overwrites infoPlist at prebuild, so they must match).

### In-app copy

- [x] ✅ EN + RO translations across all 25 screens
- [ ] ⚠️ Sweep for untranslated/dev-ish strings — known example: `Session #{id}`
  hardcoded in English on My Schedule; also check Alert titles like "Unavailable",
  "No Active Subscription" in checkout.tsx (English-only)
- [ ] ☐ No "TODO", "test", lorem ipsum, or debug text anywhere in UI
- [ ] ☐ Romanian diacritics render correctly in the shipped font

### Store listing copy rules (Guideline 2.3)

- [ ] ☐ App name ≤ **30 chars** ("Trainee" ✅ — but check name availability; single
  common words often collide; consider "Trainee – Găsește-ți antrenor" style subtitle)
- [ ] ☐ Subtitle ≤ **30 chars**, value proposition, no prices
- [ ] ☐ Description: **no prices** (they vary by region), **no "also on Android"**,
  no competitor names, accurately describes trainer-subscription model
- [ ] ☐ Keywords: ≤ **100 chars**, comma-separated, **no spaces after commas**, no
  words already in name/subtitle, singular OR plural not both, no competitor names
- [ ] ☐ Romanian (ro) localization of the whole listing — primary market
- [ ] ☐ What's New text for 1.0 written

## 6. HIG / design compliance

### Touch targets (minimum 44×44 pt)

Raw icon sizes in the codebase are below 44pt and rely on `hitSlop` — verify the
*effective* target reaches 44pt:

- [ ] ⚠️ Pack sheet +/− buttons: 24pt icons + `hitSlop 8` = 40pt effective — bump
  hitSlop to 10+
- [ ] ⚠️ Slot delete trash icon: 18pt + `hitSlop 8` = 34pt — bump hitSlop to 13+
- [ ] ⚠️ Pack badge on slot card: `hitSlop 6` — bump
- [ ] ☐ Audit remaining small Pressables (3-dots menus, chevrons) the same way

### Type & layout

- [x] ✅ Light-only (`userInterfaceStyle: "light"`) — opting out of Dark Mode is
  allowed; it must be *consistent*, which a single declared style is
- [ ] ☐ Dynamic Type: RN scales text by default (`allowFontScaling`); test the app
  at iOS Text Size maximum — fixed-height cards (slot cards, badges, checkout rows)
  must not clip text. Fix clipping or cap scaling per-component, don't disable
  scaling globally
- [ ] ☐ Minimum text size ≥ 11pt everywhere (check `caption` typography usages)
- [ ] ☐ Contrast: gray-on-white secondary text (`#64748B` on white ≈ 4.7:1) ✅; check
  any lighter grays

### Navigation & modals

- [x] ✅ expo-router stack navigation with system back behavior
- [x] ✅ Bottom sheets have backdrop-tap dismiss + `onRequestClose` (hardware back)
- [ ] ☐ Every modal/sheet has a visible way out (spot-check: pack sheet, day controls
  sheet, coach-mark tour can always be skipped)
- [ ] ☐ No gesture conflicts: day-planner drag-and-drop must not fight the system
  edge-swipe-back gesture — test near screen edges

### Empty states

- [ ] ☐ Every list has a guiding empty state (search results, map with no gyms,
  My Schedule, suggestions, reviews) — extra important given cold-start (see §1)

## 7. Privacy (Guideline 5.1.x)

- [x] ✅ Privacy manifest in app.json: `NSPrivacyTracking: false`, no tracking
  domains, required-reason APIs declared (UserDefaults CA92.1, FileTimestamp C617.1)
- [x] ✅ No ATT prompt — correct, since nothing tracks across apps (adding an
  unnecessary ATT prompt is itself a rejection)
- [ ] ⚠️ Add Device ID (push token) to manifest + labels — see §1
- [ ] ☐ Verify declared types still match reality: Name, Email, Phone, User ID,
  Coarse Location, Photos/Videos, Payment Info, Purchase History. Question to
  answer: **is Phone Number actually collected?** If no field collects it, remove
  it from the manifest and labels — over-declaring also counts as a mismatch
- [ ] ☐ App Store Connect privacy nutrition labels filled to match the manifest
  exactly
- [ ] ☐ Privacy policy **URL** live and reachable (PRIVACY_POLICY.md is the source —
  it needs to be hosted; the URL goes in App Store Connect)
- [x] ✅ Privacy policy accessible in-app (`app/legal.tsx`)
- [ ] ☐ Privacy policy mentions: RevenueCat (purchases), AWS S3 (photos), push
  tokens (reminders), and Romanian/GDPR specifics — re-read it against the current
  feature set since packs/invites/reminders were added
- [x] ✅ **Account deletion in-app** (Apple requires it for apps with accounts) —
  exists in user profile deletion flow; verify it's reachable in ≤ 3 taps and
  actually deletes server-side
- [ ] ☐ Third-party SDK privacy manifests: RevenueCat, Stripe RN, expo SDKs ship
  their own — verify current versions bundle manifests (they do in recent versions;
  just don't pin ancient versions)

## 8. In-App Purchase / subscriptions (Guideline 3.1.1)

Model check: **trainers pay a subscription to be listed — that's a digital service
and MUST use IAP** ✅ (RevenueCat wraps StoreKit). Client↔trainer payments for
actual training sessions happen off-app (cash) — that's a real-world service and
correctly stays out of IAP. Do not add any in-app payment path between clients and
trainers without revisiting this.

- [x] ✅ Auto-renewal disclosure shown before purchase (price, period, 24h renewal
  language, cancellation) — checkout.tsx legal disclaimer
- [x] ✅ Trial terms shown when a trial is offered (duration + post-trial price)
- [x] ✅ Restore Purchases button, functional, with error states
- [x] ✅ Terms of Use + Privacy Policy links on the paywall (→ /legal)
- [x] ✅ Manage/cancel routes to `apps.apple.com/account/subscriptions`
- [x] ✅ Stripe (web checkout) gated OFF on native — no external purchase path,
  no "pay on our website" text anywhere in the iOS binary. Keep it that way; even a
  *mention* is Guideline 3.1.1 bait
- [ ] ☐ Subscription products created in App Store Connect: subscription group,
  localized display names (EN+RO), prices, and **review screenshot** per product
- [ ] ☐ Products linked in RevenueCat dashboard; entitlement id matches server
  (`config/billingPlans.ts` ↔ RevenueCat ↔ ASC product ids)
- [ ] ☐ Sandbox test: purchase, cancel, restore, and interrupted purchase on a real
  device with a sandbox Apple ID (see `PAYMENT_TESTING_GUIDE.md`)
- [ ] ☐ Terms of Use: if using Apple's standard EULA, link it in the description
  metadata; custom TERMS_OF_USE.md needs a hosted URL in App Store Connect
- [ ] ☐ **Founding-trainer free period**: implement as RevenueCat granted
  entitlements or intro offers — do NOT describe "free because we comped you
  outside the App Store" in store metadata

## 9. Push notifications (new — reminders feature)

- [x] ✅ Opt-in toggle in-app; default off until user enables (permission prompt
  only fires on user action — good, Apple dislikes cold prompts)
- [x] ✅ Transactional only (session reminders at 19:00) — no marketing pushes, so
  no marketing-consent requirements
- [ ] ⚠️ Plugin + entitlement + APNs key — see §1 blockers
- [ ] ☐ Test on a real iOS build: toggle on → permission prompt → book tomorrow
  slot → reminder arrives at 19:00 Bucharest
- [ ] ☐ Denied-permission path shows the settings hint (implemented — verify device
  behavior)

## 10. Screenshots & preview (per localization: en-US + ro)

- [ ] ☐ **6.9-inch iPhone set** (mandatory) — 1–10 shots, real UI only, no mockups
- [ ] ☐ **13-inch iPad set** — required while `supportsTablet: true` (see §1)
- [ ] ☐ Romanian screenshots show the app in Romanian
- [ ] ☐ Suggested storyline: search results with trainers → trainer profile with
  reviews → gym map → schedule/day planner → client schedule with check-in code →
  (avoid showing the paywall as a hero shot)
- [ ] ☐ Status bar clean in screenshots (full battery, no carrier weirdness)
- [ ] ☐ Optional app preview video ≤ 30s, real capture, good poster frame

## 11. App Review information (Guideline 2.1 — the #1 rejection)

- [ ] ☐ **Two demo accounts** in review notes: one CLIENT, one TRAINER (with active
  subscription state via sandbox/RevenueCat) — both seeded with realistic data:
  profile photos, schedule with slots, a session pack, reviews
- [ ] ☐ Review notes explain the non-obvious flows:
  - two-sided model; trainer pays, client free
  - check-in code flow (client generates 6-digit code → trainer enters it)
  - trainer invite code flow
  - geographic focus (Romania) and how to see populated data
  - that Stripe appears in the bundle but is disabled on iOS (preempt the question)
- [ ] ☐ Contact info + a phone number that answers during review
- [ ] ☐ Backend production server up, monitored, and fast during the review window —
  a 500 during review is a 2.1 rejection

## 12. App Store Connect metadata (final pass)

- [ ] ☐ Category: **Health & Fitness** (primary); secondary optional
- [ ] ☐ Age rating questionnaire (expect 4+; no user-generated content concerns
  beyond reviews — declare "infrequent user-generated content" honestly since
  reviews + photos exist, and confirm you have moderation: report/issue flow ✅ exists)
- [ ] ☐ Content rights declaration
- [ ] ☐ Support URL (required) — a page with contact info
- [ ] ☐ Marketing URL optional
- [ ] ☐ Copyright line
- [ ] ☐ Availability: at minimum Romania; decide worldwide vs staged
- [ ] ☐ Pricing: app itself Free
- [ ] ☐ Phased release ON for post-1.0 updates (not applicable to first release)

## 13. Final pre-flight sequence

1. [ ] Fix §1 blockers → commit
2. [ ] `eas build --platform ios --profile production` (Xcode 26 image)
3. [ ] TestFlight internal: walk EVERY screen on 2 device sizes, both languages,
   both roles; full IAP sandbox pass; reminders end-to-end
4. [ ] Upload screenshots + metadata (EN + RO), privacy labels, review notes,
   demo credentials
5. [ ] Seed production data (founding trainers) so the reviewer sees a live app
6. [ ] Submit for review; monitor Resolution Center daily; respond factually with
   screen recordings if anything is questioned
7. [ ] After approval: release manually (don't auto-release) so launch timing is
   yours

---

*Cross-reference: existing deep-dives in `FINAL_PRESUBMISSION_REPORT.md` and
`SUBSCRIPTION_IAP_ASSESSMENT.md` predate session packs, trainer invites, and push
reminders — trust this file where they disagree.*
