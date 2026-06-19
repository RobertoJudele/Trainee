# App Store Review — Pre-Submission Audit

Running checklist of App Store rejection risks found in this project and what to fix.
Generated via the `app-store-review` skill. Re-verify against current Apple docs before submitting.

> **Fix progress (2026-06-18):** Applied — deleted dead root manifest; added Purchase History to
> `app.json`; location declaration → **Coarse** (matches `Accuracy.Balanced`); removed unused
> "Always" location string; sharpened add-only photo string; added auto-renewal disclosure +
> Terms/Privacy links to the paywall (`checkout.tsx → /legal`); gated the debug panel behind
> `__DEV__`; removed stray `console.log`s in `RequireAuth.tsx`. Typecheck passes.
> **Decided/deferred:** Stripe Apple Pay merchant ID kept as placeholder for future Stripe work
> (dead config today, see §2). **Operational (App Store Connect, not code):** demo credentials,
> privacy policy URL, products "Ready to Submit", screenshots/metadata, Xcode 26+ build.

Legend: 🔴 blocking · 🟡 should-fix · 🟢 ok/no action

---

## 1. Privacy Manifest  — _audited 2026-06-18_

**Architecture note:** `ios/` is gitignored → this project uses Expo prebuild (CNG).
The native `ios/.../PrivacyInfo.xcprivacy` is **generated from `app.json` →
`ios.privacyManifests`**. That is the only manifest that ships. The tracked file
`frontend/PrivacyInfo.xcprivacy` (root) is **dead** — referenced by nothing, never built.

### To repair
- [ ] 🟡 **Delete `frontend/PrivacyInfo.xcprivacy`** (root). It never ships, diverges from
      `app.json`, and uses invalid Apple keys (`NSPrivacyCollectedDataTypePhotoVideo`,
      `NSPrivacyCollectedDataTypeLocation`) plus a bogus `Contacts` entry (no contacts SDK/usage).
      Leaving it risks a teammate editing the wrong file.
- [ ] 🟡 **Add Purchase History to `app.json`.** RevenueCat (`react-native-purchases`, used in
      `checkout`, `_layout`, `TrainerProfile`, `UserProfile`) collects purchase history.
      Add a `NSPrivacyCollectedDataTypePurchaseHistory` entry to
      `app.json → ios.privacyManifests.NSPrivacyCollectedDataTypes`.
- [ ] 🟡 **Decide `UserID` purposes.** Currently only `AppFunctionality`. If RevenueCat/analytics
      profile users by ID, add `NSPrivacyCollectedDataTypePurposeAnalytics`. Verify actual use first.
- [ ] 🟡 **Cross-check App Store Connect nutrition labels.** They must match the manifest exactly:
      Coarse Location, Photos/Videos, Email, **Name**, **Phone Number**, User ID, Payment Info,
      Purchase History. Mismatch = Guideline 5.1.2 rejection risk.

### Verified OK
- 🟢 `app.json` declares Coarse Location, Photos/Videos, Email, Name, Phone Number, User ID,
      Payment Info, Purchase History. (**Name + Phone Number added 2026-06-18** — both are collected at
      sign-up via `SignUp.tsx` → `RegisterRequest`, so they must be declared.)
- 🟢 Required-reason APIs (`UserDefaults / CA92.1`, `FileTimestamp / C617.1`) are correct/standard.
- 🟢 Bundled SDKs (async-storage, expo-file-system, react-native, react-native-maps) ship their
      own manifests; no need to redeclare their required-reason APIs at app level.

---

## 2. Entitlements & Usage Strings  — _audited 2026-06-18_

Source: `app.json → ios.infoPlist`, `ios.privacyManifests`, plugin config, and code usage.

### To repair
- [ ] 🟡 **DEFERRED (decision 2026-06-18): Apple Pay merchant identifier is a placeholder.**
      `merchant.com.example.trainee` in `app.json` (`@stripe/stripe-react-native` plugin) and
      `app/_layout.tsx:101` (StripeProvider). This is the **Stripe** Apple Pay ID — independent of
      the RevenueCat/StoreKit subscription (which needs no merchant ID). Stripe is **not yet
      implemented** and its checkout path is gated off on iOS (`EXPO_PUBLIC_ENABLE_STRIPE_CHECKOUT`),
      so the placeholder is **dead config and not an App Review risk today**. Owner chose to keep it
      for future Stripe work.
      **⚠️ Before shipping any Stripe Apple Pay flow:** register a real merchant ID in the Apple
      Developer account (e.g. `merchant.com.juroctech.…`), add the Apple Pay capability/entitlement,
      and replace the placeholder in both files — otherwise the Apple Pay sheet fails at runtime.
- [ ] 🟡 **Background ("Always") location declared but never used.** Code only calls
      `requestForegroundPermissionsAsync` + `getCurrentPositionAsync` (`app/map.tsx:316`).
      `NSLocationAlwaysAndWhenInUseUsageDescription` is set in `app.json` with a string that only
      justifies foreground use ("find nearby gyms and trainers"). Apple scrutinizes Always-location
      hard. **Remove the Always key; keep only `NSLocationWhenInUseUsageDescription`.**
- [ ] 🟡 **Location accuracy vs. manifest mismatch.** Code uses `Accuracy.Balanced` (≈ coarse),
      but the privacy manifest declares `NSPrivacyCollectedDataTypePreciseLocation`. Reconcile:
      either bump accuracy if you truly need precise, or switch the manifest entry to
      `NSPrivacyCollectedDataTypeCoarseLocation`.
- [ ] 🟡 **Vague add-only photo string.** `NSPhotoLibraryAddOnlyUsageDescription`
      ("Your app needs permission to save photos to your library.") names no feature.
      Make it specific (e.g., "...to save workout photos you capture").
- [ ] 🟢/🟡 **Duplicate photo/camera usage strings.** Set in both `ios.infoPlist` and the
      `expo-image-picker` plugin config. They currently match (harmless) but keep a single source
      of truth to avoid future drift.

### Verified OK
- 🟢 Camera, Location-WhenInUse usage strings are specific and purpose-driven.
- 🟢 `ITSAppUsesNonExemptEncryption: false` — correct (only standard HTTPS/Stripe exempt crypto).

---

## 3. IAP / StoreKit (Guideline 3.1.1 + 3.1.2)  — _audited 2026-06-18_

**What's sold:** an auto-renewable subscription — "Premium Trainer Access" /
entitlement `trainer_subscription`, ~RON 100/month. This is **digital functionality**, so on iOS
it **must** use Apple IAP. Source: `app/checkout.tsx`, `features/billing/billingApiSlice.ts`.

### ✅ Core 3.1.1 — COMPLIANT (no action)
- 🟢 On native (`isNativeApp = ios || android`), purchase goes through
      `Purchases.purchasePackage` → RevenueCat → **Apple IAP**. Correct.
- 🟢 Stripe web checkout is gated behind `!isNativeApp && EXPO_PUBLIC_ENABLE_STRIPE_CHECKOUT==="1"`.
      On iOS the Stripe `/create-checkout-session` path and billing portal are **unreachable** — no
      external purchase path/links/CTAs for the digital subscription. This is exactly what 3.1.1 wants.
- 🟢 **Restore Purchases** implemented (`restorePurchases`) — required by 3.1.1.
- 🟢 "Manage Subscription" on iOS opens `apps.apple.com/account/subscriptions` — correct.

### To repair
- [ ] 🔴 **Missing subscription disclosures on the paywall (Guideline 3.1.2).** The "Choose Your
      Plan" screen shows title + localized price + description, but Apple requires on the purchase
      screen, before buying: (1) a clear **auto-renewal statement** (renews unless canceled ≥24h
      before period end), (2) a functional link to **Terms of Use / EULA**, and (3) a functional
      link to **Privacy Policy**. These are a very common subscription rejection. Add them to the
      paywall in `checkout.tsx`.
- [ ] 🟡 **Developer "Debug Diagnostics" panel is user-visible.** `debugErrorMessage`
      (`checkout.tsx`, e.g. "Your Apple Paid Apps Agreement is signed…", raw native error strings)
      renders in the UI for end users / reviewers. Looks like unfinished/test content → Guideline
      2.1 risk. Gate behind `__DEV__` or remove.
- [ ] 🟡 **Reviewer must be able to complete the purchase in sandbox.** The retry logic + "Could
      not load subscription plans" path implies past offerings-config races. Before submitting:
      sign the Paid Apps Agreement, set products to "Ready to Submit", confirm product IDs match
      the RevenueCat dashboard, and add App Review notes. If offerings fail to load, the reviewer
      hits a dead paywall → Guideline 2.1 rejection.
- [ ] 🟡 **Hardcoded price string.** Subscribed view shows hardcoded "RON 100.00 / month"
      (`checkout.tsx:751`); the paywall correctly uses `product.priceString`. Use the
      StoreKit-localized price everywhere so other regions don't see a wrong/mismatched price.

### Verify (not blocking)
- [ ] Confirm Stripe (`StripeProvider` in `_layout.tsx`, Apple Pay) is used **only** for
      real-world/physical services (e.g., booking in-person sessions), which 3.1.1 permits — not for
      any in-app digital unlock. If it's not used for anything on iOS, consider removing it (ties to
      the placeholder Apple Pay merchant-ID issue in §2).

---

## 4. ATT, Privacy Policy & 2.1 Completeness  — _audited 2026-06-18_

### App Tracking Transparency — ✅ correct, no action
- 🟢 No tracking/ad SDKs present (no AdMob, Firebase Analytics, Facebook, Segment, Amplitude,
      Mixpanel, Sentry). Manifest declares `NSPrivacyTracking: false`, empty tracking domains.
- 🟢 No `requestTrackingAuthorization` / `NSUserTrackingUsageDescription` — so **no unnecessary ATT
      prompt** (Apple rejects those). The "analytics" in the app is the first-party **Trainer
      Analytics** feature (profile-view stats from your own backend), not cross-app tracking.

### Privacy Policy in-app — ✅ present
- 🟢 `app/legal.tsx` renders **Terms of Use** *and* **Privacy Policy** in-app (segmented view) →
      satisfies the "accessible within the app" half of Guideline 5.1.2.
- 🔗 **Ties to §3:** the 3.1.2 paywall gap can be fixed cheaply — this legal content already exists,
      so just link the paywall (`checkout.tsx`) to `/legal` (or hosted URLs).

### To repair
- [ ] 🔴 **Provide demo credentials (Guideline 2.1).** App gates everything behind auth
      (`features/auth/RequireAuth.tsx` redirects to `(auth)` when no token). The #1 cause of 2.1
      rejections is a reviewer who can't get past login. Put a working **demo account** (and a
      trainer-role account, since trainer features differ) in App Store Connect → App Review notes.
- [ ] 🟡 **Set Privacy Policy URL in App Store Connect.** In-app legal text covers the in-app
      requirement, but the metadata field still needs a reachable **privacy policy URL** (5.1.2).
- [ ] 🟡 **Privacy-policy wording vs. reality.** `legal.tsx` says data is shared with "analytics
      vendors"; the app ships no third-party analytics SDK and the manifest declares no tracking.
      Keep policy, manifest, and nutrition labels telling the same story (tighten the wording or
      confirm a backend vendor actually applies).
- [x] 🟢 ~~stray `console.log` of auth segments in `RequireAuth.tsx`~~ — **fixed 2026-06-18**.

### Verified OK
- 🟢 Error/empty/loading states present in audited screens (trainer-analytics, checkout).

---

## 5. Metadata, Build & HIG — _audited 2026-06-19_

### 5a. Dark Mode — 🟡 NOT SUPPORTED

- `app.json` sets `"userInterfaceStyle": "light"` → Expo forces light mode system-wide. The app
  does not respond to system dark-mode at all.
- `theme.ts` contains a single light palette (background `#F8FAFC`, surface `#FFFFFF`,
  text `#0F172A`). No dark variant, no `useColorScheme`, no `Appearance` API usage anywhere.
- Many screens use inline hardcoded light-only colors (e.g. `backgroundColor: "#fff"`,
  `color: "#333"`, `backgroundColor: "#F8F9FA"`) outside the theme system — at least
  `TrainerProfile.tsx`, `CreateTrainer.tsx`, `[date].tsx`, `week-snapshot.tsx`, `map.tsx`.
- **HIG note:** Apple's HIG *strongly recommends* Dark Mode support but it is **not an App Review
  rejection reason** on its own. Locking to `"userInterfaceStyle": "light"` is a valid choice —
  Apple will not reject for this.
- **Recommendation:** acceptable for launch. If adding Dark Mode later, centralize all colors
  through the theme first (eliminate inline hex values), then add a dark palette.

### 5b. Dynamic Type — 🟡 NOT SUPPORTED (low rejection risk)

- `typography` in `theme.ts` uses fixed `fontSize` values (12–34px). No screen uses
  `allowFontScaling`, `maxFontSizeMultiplier`, or React Native's built-in Dynamic Type scaling.
- React Native's `<Text>` defaults to `allowFontScaling={true}`, so system font scaling
  **does partially work** — but fixed layout dimensions can break with large accessibility sizes
  (text clipping, overlapping badges, overflowing cards).
- **HIG note:** Dynamic Type support is recommended but **not a rejection requirement** per se.
  Apple may flag it under Guideline 4.0 (Design) if the app is fully unusable at large sizes, but
  a fitness app with fixed-size UI is very unlikely to be rejected for this alone.
- **Recommendation:** acceptable for launch. For a future pass, add `maxFontSizeMultiplier={1.3}`
  to key UI Text elements and test at the largest system size.

### 5c. Launch Screen / Splash — 🟢 OK

- `app.json → splash` configured: `splash-icon.png`, `resizeMode: "contain"`,
  `backgroundColor: "#ffffff"`. Expo generates the native launch storyboard from this.
- No placeholder / "Powered by" / test text visible.

### 5d. Navigation Patterns — 🟢 OK

- Uses `expo-router` `<Stack>` with `slide_from_right` animation (standard iOS push navigation).
- Back buttons present on all sub-screens (profile, search, map, schedule, preferences, legal).
- No non-standard gestures that would confuse an Apple reviewer.
- Modals used appropriately (gym browser in `my-gyms.tsx`, dropdown menus in profiles).

### 5e. StatusBar — 🟡 MINOR

- `_layout.tsx` sets `<StatusBar style="light" />` globally. This works on gradient headers
  (Welcome, Home, Profile) but on screens with white/light backgrounds (search, schedule,
  preferences) the white status-bar text becomes invisible against the light header.
- **Rejection risk:** Low — but it's a visible UX bug. Consider `style="auto"` or per-screen
  status bar control.

### 5f. iPad Support — 🟡 NEEDS SCREENSHOTS

- `app.json` sets `"supportsTablet": true` → the app runs on iPad natively (not scaled).
- This **triggers the App Store Connect requirement for 13-inch iPad screenshots**. You must
  provide them or change `supportsTablet` to `false`.
- The UI is phone-first with no tablet-specific layout (no sidebar, no split view). On iPad it
  will render as a stretched phone app. This is **not a rejection reason** — many apps ship
  phone-first on iPad — but screenshots must still be provided.

### 5g. App Name & Bundle ID — 🟢 / 🟡

- Display name: `Trainee` (7 chars) — well within 30-char limit. ✅
- Bundle ID: `com.juroctech.frontend` — the `.frontend` suffix is unusual and user-facing in
  some contexts (Keychain groups, iCloud containers). Not a rejection risk but consider a cleaner
  ID like `com.juroctech.trainee` for future builds. **Cannot change after first submission
  without creating a new App Store listing.**

### 5h. Build / SDK — 🟢 DONE

- Xcode 26+ / SDK 26+ requirement for uploads after 2026-04-28 confirmed done (per §C above).

### 5i. Metadata (ASC-only items) — ⏳ OUTSTANDING

These live in App Store Connect, not in the repo:
- Subtitle (≤30 chars)
- Keyword field (≤100 chars, comma-separated, no spaces after commas)
- 6.9-inch iPhone screenshot set (1–10 screenshots)
- 13-inch iPad screenshot set (**required** since `supportsTablet: true`)
- App Preview video (optional, ≤30s)
- No prices in description, no other-platform references

Cannot verify from code — verify at submission time.

---

# ✅ Remaining To Fix — consolidated checklist

Single source of truth for what's still open. Code fixes from §1–§4 are already applied
(see top-of-file progress note). Everything below is still outstanding.

## A. Code / repo
- [x] 🟡 ~~**§3 — Replace hardcoded price `RON 100.00 / month`**~~ — **fixed 2026-06-18**. Added
      `monthlyPriceLabel` memo in `checkout.tsx` using RevenueCat offering `priceString` (localized),
      with last-transaction fallback; swapped into the Billing Cycle row. Typecheck passes.
- [x] 🟡 ~~**§4 — Privacy-policy wording vs. reality**~~ — **fixed 2026-06-18**. Removed "analytics
      vendors" from `legal.tsx` (owner confirmed no third-party analytics); policy now matches the
      no-tracking manifest.
- [ ] 🔴 **§3 — Verify the paywall fix end-to-end (needs iOS build).** Confirm the auto-renewal text +
      Terms/Privacy links render and `/legal` opens, and that Billing Cycle shows the localized price.
      Can't run on win32 — requires macOS/EAS simulator or device build.
- [x] 🟡 ~~**§3 — Sandbox purchase must complete (operational).**~~ — **done 2026-06-18.** Sandbox
      purchase confirmed to complete end-to-end: offerings load reliably (no "no_plans"/dead-paywall
      path hit), paywall reachable, purchase flow finishes. No longer a Guideline 2.1 risk.
- [x] 🟢 ~~**§3 — Paywall showed USD ($17.99) while Apple sheet billed 99,99 RON**~~ — **RESOLVED /
      not a bug (2026-06-18).** On-device diagnostic showed `storefront=USA`. Root cause: **TestFlight
      runs IAP in the sandbox environment, where the storefront/currency follows the *Sandbox Apple
      Account* (Settings → Developer → Sandbox Apple Account), not the real Media & Purchases account.**
      With no sandbox tester signed in, sandbox defaults to the **US** storefront → USD prices.
      `priceString` was correct — it followed the sandbox storefront. **Production is unaffected:** real
      users aren't in sandbox; each loads + buys under their own storefront, so paywall and sheet always
      match. Code/RevenueCat config are fine.
      **To test RON in sandbox:** create a Romania sandbox tester (ASC → Users and Access → Sandbox)
      and sign into it on-device. **TEMP `priceDebug` diagnostic removed from `checkout.tsx` (2026-06-18).**

## B. Decided / deferred (no action now)
- [ ] 🟡 **§2 — Stripe Apple Pay merchant ID** kept as placeholder for future Stripe work (dead config
      today). ⚠️ Register a real merchant ID + Apple Pay capability **before** shipping any Stripe
      Apple Pay flow, or the sheet fails at runtime.
- [ ] 🟡 **§1 — `UserID` purposes** currently `AppFunctionality` only; add `Analytics` purpose only if
      you actually profile users by ID.

## C. App Store Connect / operational — NOT code (do at submission)
- [ ] 🔴 **Demo credentials (Guideline 2.1).** App Review Information → enable "Sign-In Required",
      provide a working **regular** account AND a **trainer** account (trainer features differ:
      analytics, schedule, subscription). Keep accounts alive + seeded with realistic data; no 2FA/SMS
      the reviewer can't pass.
- [x] 🔴 ~~**Products "Ready to Submit"** + Paid Apps Agreement signed + product IDs match RevenueCat,
      so the reviewer's IAP purchase works.~~ — **done 2026-06-18.**
- [ ] 🟡 **Privacy Policy URL** set in the App Store Connect metadata field (5.1.2).
      _Checked 2026-06-18:_ no hosted privacy/terms URL exists in `app.json` or app code — the policy
      currently only ships in-app via `app/legal.tsx`. `PRIVACY_POLICY.md` (repo root) is available to
      host. Still outstanding: host it and paste the URL into ASC.
- [ ] 🟡 **Privacy nutrition labels** must match the manifest exactly: Coarse Location, Photos/Videos,
      Email, User ID, Payment Info, Purchase History.
      _Manifest side verified 2026-06-18:_ `app.json → ios.privacyManifests` declares **8 types** —
      Coarse Location, Photos/Videos, Email, **Name**, **Phone Number**, User ID, Payment Info,
      Purchase History (location is **Coarse**, not Precise — consistent with §2; Name + Phone Number
      added after confirming both are collected at sign-up). Outstanding work is the ASC side only:
      mirror all 8 in App Store Connect nutrition labels.
- [ ] 🟡 **Metadata/screenshots** — name & subtitle ≤30 chars; keyword field ≤100 chars comma-separated
      no spaces; 6.9" iPhone + 13" iPad screenshot sets; no prices / no other-platform mentions.
      _Checked 2026-06-18:_ app display name is `Trainee` (7 chars, well within 30). Subtitle, keywords,
      and screenshots are ASC-only (not in repo) — still outstanding.
- [x] 🔴 ~~**Build with Xcode 26+ / platform SDK 26+** (required for uploads after 2026-04-28).~~ —
      **done 2026-06-18.**

## D. Metadata / Build / HIG — audited 2026-06-19
- [x] 🟢 **§5a — Dark Mode** — not supported (`userInterfaceStyle: "light"`). Acceptable for launch;
      not a rejection reason. Many inline hardcoded colors exist outside theme — centralize before
      adding dark mode.
- [x] 🟢 **§5b — Dynamic Type** — not explicitly supported but RN default `allowFontScaling` provides
      partial scaling. Low rejection risk for a fitness app. Future: add `maxFontSizeMultiplier`.
- [x] 🟢 **§5c — Launch screen** — splash configured correctly in `app.json`.
- [x] 🟢 **§5d — Navigation** — standard Stack navigation, back buttons present, modals used correctly.
- [ ] 🟡 **§5e — StatusBar** — globally `light` style causes invisible text on white-background screens.
      Consider `style="auto"` or per-screen control. Not blocking.
- [ ] 🟡 **§5f — iPad screenshots** — `supportsTablet: true` triggers the 13-inch iPad screenshot
      requirement in ASC. Either provide iPad screenshots or set `supportsTablet: false`.
- [x] 🟢 **§5g — App name** — `Trainee` (7 chars), well within 30. Bundle ID `com.juroctech.frontend`
      is functional but the `.frontend` suffix is unusual — cannot change after first submission.
- [x] 🟢 **§5h — Build/SDK** — Xcode 26+ confirmed.
- [ ] 🟡 **§5i — ASC metadata** — subtitle, keywords, screenshots, description still outstanding
      (App Store Connect only, not in repo).

