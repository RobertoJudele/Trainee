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
- [x] 🟢 **Delete `frontend/PrivacyInfo.xcprivacy`** (root) — **DONE (2026-06-20).** File deleted.
- [x] 🟢 **Add Purchase History to `app.json`** — **DONE (2026-06-18).** Added to
      `app.json → ios.privacyManifests.NSPrivacyCollectedDataTypes`.
- [ ] 🟡 **Decide `UserID` purposes.** Currently only `AppFunctionality`. If RevenueCat/analytics
      profile users by ID, add `NSPrivacyCollectedDataTypePurposeAnalytics`. Verify actual use first.
      _(Deferred.)_
- [x] 🟢 **Cross-check App Store Connect nutrition labels** — **DONE (2026-06-20).** All 8 manifest
      types mirrored in ASC.

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
- [x] 🟢 **Background ("Always") location** — **DONE (2026-06-20).** `NSLocationAlwaysAndWhenInUseUsageDescription`
      removed from `app.json`. Only `WhenInUse` remains.
- [x] 🟢 **Location accuracy vs. manifest** — **DONE.** Manifest switched to
      `NSPrivacyCollectedDataTypeCoarseLocation` (matches `Accuracy.Balanced`).
- [x] 🟢 **Add-only photo string** — **DONE (2026-06-20).** Now reads "Allow saving workout and
      profile photos you create to your photo library."
- [ ] 🟡 **Duplicate photo/camera usage strings.** Set in both `ios.infoPlist` and the
      `expo-image-picker` plugin config. They currently match (harmless) but keep a single source
      of truth to avoid future drift. _(Deferred.)_

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

### Verified / Fixed
- [x] 🟢 **Subscription disclosures on the paywall (Guideline 3.1.2) — FIXED.**
      Auto-renewal statement, Terms of Use link, and Privacy Policy link all present in
      `checkout.tsx`. Links route to `/legal`.
- [x] 🟢 **Debug Diagnostics panel — FIXED.** Gated behind `__DEV__`.
- [x] 🟢 **Sandbox purchase — VERIFIED.** Offerings load, paywall reachable, purchase completes.
- [x] 🟢 **Hardcoded price — FIXED.** `monthlyPriceLabel` uses `priceString` (localized) with
      transaction fallback.

### Verify (not blocking)
- [x] 🟢 Stripe is **not used on iOS** — gated behind `EXPO_PUBLIC_ENABLE_STRIPE_CHECKOUT` and
      `!isNativeApp`. Dead config today; placeholder merchant ID kept for future Stripe work (see §2).

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
- [x] 🟢 **Provide demo credentials (Guideline 2.1)** — **DONE (2026-06-20).** Regular user +
      trainer account credentials set in ASC App Review Information with notes explaining both roles.
- [x] 🟢 **Set Privacy Policy URL in App Store Connect** — **DONE (2026-06-20).**
- [x] 🟢 **Privacy-policy wording vs. reality** — **DONE (2026-06-18).** Removed "analytics vendors"
      from `legal.tsx` (no third-party analytics SDK).
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

### 5e. StatusBar — 🟢 OK (verified 2026-06-20)

- `_layout.tsx` sets `<StatusBar style="light" />` globally. All screens either use the dark
  Stack header (`theme.colors.primary`) or have their own dark gradient/header with
  `headerShown: false`. Light status bar text is correct everywhere — no invisible text.

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

### 5i. Metadata (ASC-only items) — ⏳ PARTIALLY DONE

These live in App Store Connect, not in the repo:
- [ ] Subtitle (≤30 chars)
- [ ] Keyword field (≤100 chars, comma-separated, no spaces after commas)
- [ ] 6.9-inch iPhone screenshot set (1–10 screenshots)
- [ ] 13-inch iPad screenshot set (**required** since `supportsTablet: true`)
- [ ] App Preview video (optional, ≤30s)
- [ ] No prices in description, no other-platform references
- [x] Privacy Policy URL — set
- [x] Privacy nutrition labels — set
- [x] Age rating — set (12+)

Cannot verify from code — verify at submission time.

---

## 6. Code Hygiene, i18n & Security  — _audited 2026-06-19_

### 6a. Console Logging in Production — 🟢 FIXED (2026-06-20)

All ~35+ `console.log`/`console.error` calls removed from production code, including credential
logging in `authApiSlice.ts`, API responses in `trainerApiSlice.ts`, and billing errors in
`billingApiSlice.ts`. No `console.log` calls remain outside of `__DEV__` gates.

### 6b. Hardcoded / Untranslated UI Strings — 🟢 FIXED (2026-06-20)

All hardcoded Alert.alert strings replaced with `t()` keys. Romanian slot text in
`TrainerSchedule.tsx` fixed. `TrainerImageSection.tsx` and `useProfilePictureUpload.ts` alerts
now use translation keys.

### 6c. Placeholder Production API URL — 🟢 FIXED (2026-06-20)

`config.ts` now throws at startup if `EXPO_PUBLIC_API_URL` or `EXPO_PUBLIC_API_URL_PROD` are not
set in production. No silent fallback to a non-existent domain. `http://localhost:8000` fallback
remains for `__DEV__` only.

### 6d. User-Generated Content — 🟢 OK

- Reviews: `features/review/reviewApiSlice.ts` — CRUD for trainer reviews. Reviews go through
  the backend; no inline moderation UI is needed for App Review (backend moderation suffices).
- Issue reporting: `app/report-issue.tsx` + `app/admin-issues.tsx` — user can report issues,
  admin can manage them. This satisfies Apple's expectation for a "report" mechanism.
- Trainer profiles: editable bio, images, credentials — all go through backend upload.
- No user-to-user messaging (no chat feature) → no real-time content moderation needed.

### 6e. Age Rating — 🟢 DONE (set 2026-06-20)

- Set to **12+** in ASC. UGC = yes (trainer reviews). Sexual Content/Nudity = infrequent/mild
  (trainers may upload shirtless gym photos). All other categories = no.
- Report mechanism present (`report-issue.tsx` + `admin-issues.tsx`).

### 6f. Network Security / ATS — 🟢 OK

- `config.ts` uses HTTPS for production URLs. The `http://localhost:8000` fallback only applies
  in `__DEV__` mode. No App Transport Security exceptions needed.
- No `NSAppTransportSecurity` / `NSAllowsArbitraryLoads` exceptions found in `app.json`.

---

# ✅ What's Left To Do — consolidated checklist

_Updated 2026-06-20 (pass 3)._ Tick = done, empty box = still to do.

## Completed

- [x] §6a — Remove production console.log statements (~35+ calls) — all removed
- [x] §6c — Replace placeholder production API URL — throws at startup if missing
- [x] §3 — Paywall disclosures (3.1.2) — auto-renewal text + Terms/Privacy links present
- [x] §3 — Hardcoded price — uses localized `priceString` everywhere
- [x] §3 — Debug diagnostics panel — gated behind `__DEV__`
- [x] §3 — Sandbox purchase — verified end-to-end
- [x] §6b — Untranslated Alert.alert strings — all replaced with `t()` keys
- [x] §1 — Delete dead `frontend/PrivacyInfo.xcprivacy` — deleted
- [x] §2 — Remove Always-location string — removed from `app.json`
- [x] §2 — Location accuracy vs. manifest — switched to Coarse
- [x] §2 — Sharpen add-only photo string — now feature-specific
- [x] §5e — StatusBar — verified OK (`style="light"` correct for all dark headers)
- [x] §4 — Privacy Policy URL — set in ASC metadata
- [x] §4 — Privacy nutrition labels — all 8 types mirrored in ASC
- [x] §6e — Age rating questionnaire — set to 12+ (UGC yes, Sexual Content/Nudity infrequent/mild)
- [x] §4 — RequireAuth console.log — removed
- [x] §4 — Privacy-policy wording — removed "analytics vendors" (no third-party analytics)

## Still to do

- [x] ~~§4 — Provide demo credentials (Guideline 2.1)~~ — **DONE (2026-06-20).**

- [ ] 🟡 **§5f — iPad screenshots or disable tablet.**
  `supportsTablet: true` triggers the 13-inch iPad screenshot requirement in ASC. Either provide
  iPad screenshots or set `supportsTablet: false`.

- [ ] 🟡 **Metadata/screenshots.**
  Subtitle ≤30 chars; keyword field ≤100 chars comma-separated no spaces; 6.9" iPhone + 13" iPad
  screenshot sets; no prices / no other-platform mentions in description.

## Deferred (no action now)

- [ ] §2 — Stripe Apple Pay merchant ID — placeholder `merchant.com.example.trainee` kept for future
  Stripe work (dead config today, gated off on iOS). ⚠️ Register real ID before shipping Stripe flow.

- [ ] §1 — `UserID` purposes — currently `AppFunctionality` only. Add `Analytics` purpose if you
  actually profile users by ID via RevenueCat/backend.

- [ ] §2 — Duplicate photo/camera usage strings — set in both `ios.infoPlist` and `expo-image-picker`
  plugin config. They match (harmless) but keep a single source to avoid drift.

---

# 📋 Change Log

Completed items for reference. Most recent first.

| Date | Item | What was done |
|------|------|---------------|
| 2026-06-20 | §4 — Demo credentials | Regular user + trainer account set in ASC App Review Information |
| 2026-06-20 | §4 — Privacy Policy URL | Set in ASC metadata |
| 2026-06-20 | §4 — Nutrition labels | All 8 manifest types mirrored in ASC |
| 2026-06-20 | §6e — Age rating | Set in ASC: 12+ (UGC yes, Sexual Content/Nudity infrequent/mild for shirtless gym photos) |
| 2026-06-20 | §5e — StatusBar | Verified OK — all screens have dark headers (Stack or custom gradient); `style="light"` is correct everywhere |
| 2026-06-20 | §6b — Alert i18n | All hardcoded Alert.alert strings replaced with `t()` keys |
| 2026-06-20 | §1 — Dead manifest | `frontend/PrivacyInfo.xcprivacy` deleted (already done) |
| 2026-06-20 | §2 — Always-location | `NSLocationAlwaysAndWhenInUseUsageDescription` removed from `app.json` (already done) |
| 2026-06-20 | §2 — Photo string | `NSPhotoLibraryAddOnlyUsageDescription` already feature-specific (verified) |
| 2026-06-20 | §6a — Console logs | All ~35+ `console.log`/`console.error` calls removed from production code (auth credentials, API responses, user objects, billing errors) |
| 2026-06-20 | §6c — Placeholder API URL | `config.ts` now throws at startup if `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_API_URL_PROD` are missing in production — no silent fallback |
| 2026-06-20 | §3 — Paywall verified | Auto-renewal disclosure, Terms of Use + Privacy Policy links to `/legal`, and localized `priceString` all confirmed present in `checkout.tsx` |
| 2026-06-19 | §5a–d, §5g–h, §6d–f | Audited — Dark Mode, Dynamic Type, launch screen, navigation, app name, build/SDK, UGC, age rating, ATS all verified OK or acceptable for launch |
| 2026-06-18 | §3 — Hardcoded price | Added `monthlyPriceLabel` memo using `priceString` (localized) with transaction fallback |
| 2026-06-18 | §4 — Privacy-policy wording | Removed "analytics vendors" from `legal.tsx` (no third-party analytics) |
| 2026-06-18 | §3 — Sandbox purchase | Confirmed end-to-end: offerings load, paywall reachable, purchase completes |
| 2026-06-18 | §3 — USD/RON mismatch | Resolved — sandbox storefront was US; production unaffected. `priceDebug` diagnostic removed |
| 2026-06-18 | §4 — RequireAuth console.log | Removed stray `console.log` of auth segments |
| 2026-06-18 | ASC — Products Ready | Paid Apps Agreement signed, product IDs match RevenueCat |
| 2026-06-18 | ASC — Xcode 26+ build | Confirmed built with Xcode 26+ / SDK 26+ |
| 2026-06-18 | Applied batch | Deleted dead root manifest; added Purchase History to `app.json`; location → Coarse; removed Always-location string; sharpened photo string; added paywall disclosures; gated debug panel behind `__DEV__` |
