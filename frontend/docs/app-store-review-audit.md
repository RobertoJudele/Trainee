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
      Precise Location, Photos/Videos, Email, User ID, Payment Info (+ Purchase History once added).
      Mismatch = Guideline 5.1.2 rejection risk.

### Verified OK
- 🟢 `app.json` correctly declares Precise Location, Photos/Videos, Email, User ID, Payment Info.
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

## 5. Metadata, Build & HIG — _NOT YET AUDITED_

Mostly lives in App Store Connect (not visible from the repo). To check before submission:
metadata/screenshots (app name & subtitle 30-char, keyword field 100-char comma format,
6.9" iPhone + 13" iPad screenshot sets, no prices / no other-platform mentions); Xcode 26+/SDK 26
build requirement for uploads after 2026-04-28; HIG (Dark Mode / Dynamic Type, launch screen).

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
- [ ] 🟡 **§3 — Sandbox purchase must complete (operational).** Confirm offerings load reliably (the
      retry/"no_plans" path); a dead paywall = Guideline 2.1 rejection. Mostly App Store Connect config.
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
- [ ] 🔴 **Products "Ready to Submit"** + Paid Apps Agreement signed + product IDs match RevenueCat,
      so the reviewer's IAP purchase works.
- [ ] 🟡 **Privacy Policy URL** set in the App Store Connect metadata field (5.1.2).
- [ ] 🟡 **Privacy nutrition labels** must match the manifest exactly: Coarse Location, Photos/Videos,
      Email, User ID, Payment Info, Purchase History.
- [ ] 🟡 **Metadata/screenshots** — name & subtitle ≤30 chars; keyword field ≤100 chars comma-separated
      no spaces; 6.9" iPhone + 13" iPad screenshot sets; no prices / no other-platform mentions.
- [ ] 🔴 **Build with Xcode 26+ / platform SDK 26+** (required for uploads after 2026-04-28).

## D. Not yet audited
- [ ] §5 — Metadata/build/HIG deep pass (Dark Mode, Dynamic Type, launch screen, navigation patterns).

