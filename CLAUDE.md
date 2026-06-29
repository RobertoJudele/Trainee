# Trainee — Project Map

Fitness trainer marketplace: React Native (Expo) frontend + Node.js/Express backend.
Monorepo at `C:\dev\Trainee` with two main directories.

## Quick commands

```bash
# Frontend
cd frontend && npm start          # Expo dev server
cd frontend && npx tsc --noEmit   # typecheck
cd frontend && npm run build:aab  # Android release AAB

# Server
cd server && npm run dev          # dev server (ts-node)
```

## Repository layout

```
C:\dev\Trainee\
├── frontend/          React Native (Expo ~54, RN 0.81, expo-router)
├── server/            Express + TypeScript backend
├── docs/              Thesis (licenta-fmi), app-store-review-audit.md
├── PRIVACY_POLICY.md  Hosted privacy policy source
└── TERMS_OF_USE.md    Terms of use source
```

## Frontend (`frontend/`)

### Config
- `app.json` — Expo config: bundle IDs, permissions, privacy manifest, plugins
- `tsconfig.json` — TypeScript config
- `eas.json` — EAS Build profiles
- `.env.example` — env var template (API URL, RevenueCat keys, Stripe keys)
- `app/store.ts` — Redux store + redux-persist setup
- `app/hooks.ts` — typed Redux hooks

### Route screens (`app/`)
All screens use expo-router file-based routing:

| File | Screen |
|------|--------|
| `app/_layout.tsx` | Root layout — providers (Redux, Stripe, Tour, Language, PersistGate) |
| `app/index.tsx` | Home (→ `src/screens/Home.tsx`) |
| `app/(auth)/Welcome.tsx` | Welcome / landing |
| `app/(auth)/login.tsx` | Login (→ `src/screens/Login.tsx`) |
| `app/(auth)/signup.tsx` | SignUp (→ `src/screens/SignUp.tsx`) |
| `app/(auth)/_layout.tsx` | Auth group layout |
| `app/UserProfile.tsx` | Client profile (→ `src/screens/UserProfile.tsx`) |
| `app/TrainerProfile.tsx` | Trainer profile (→ `features/trainer/TrainerProfile.tsx`) |
| `app/create-trainer.tsx` | Become-a-trainer form (→ `features/users/CreateTrainer.tsx`) |
| `app/search.tsx` | Trainer search with filters |
| `app/trainers/[id].tsx` | Trainer detail (reviews, contact, gallery) |
| `app/map.tsx` | Gym map (react-native-maps, clustering) |
| `app/my-gyms.tsx` | Trainer gym management |
| `app/trainer-schedule.tsx` | Monthly schedule + working-hours template |
| `app/trainer-schedule/[date].tsx` | Day planner (drag-assign clients to slots) |
| `app/trainer-schedule/week-snapshot.tsx` | Week overview |
| `app/my-schedule.tsx` | Client schedule + check-in code |
| `app/trainer-analytics.tsx` | Trainer profile-view analytics |
| `app/checkout.tsx` | Subscription paywall (RevenueCat IAP + Stripe web) |
| `app/preferences.tsx` | Client matching preferences |
| `app/report-issue.tsx` | Issue reporting form |
| `app/admin-issues.tsx` | Admin issue management |
| `app/legal.tsx` | Terms + Privacy Policy (in-app) |
| `app/forgot-password.tsx` | Forgot password flow |
| `app/reset-password.tsx` | Reset password flow |

### Shared UI (`src/`)

| Path | What |
|------|------|
| `src/lib/theme.ts` | Colors, typography, shadows, spacing, gradients, motion tokens |
| `src/lib/i18n/translations.ts` | EN + RO translation strings (~600 keys) |
| `src/lib/i18n/LanguageContext.tsx` | Language context + AsyncStorage persistence |
| `src/lib/imageUpload.ts` | Image picker + FormData helpers |
| `src/lib/useProfilePictureUpload.ts` | Profile picture upload hook |
| `src/api/apiSlice.ts` | RTK Query base API (auth headers, token refresh) |
| `src/constants/config.ts` | API_URL from env |
| `src/components/ui/index.tsx` | Shared UI: FadeInUp, PressableScale, Field, GradientButton, OutlineButton |
| `src/components/EditableAvatar.tsx` | Avatar with upload overlay |
| `src/components/TrainerCard.tsx` | Trainer list card |
| `src/components/TrainerImageSection.tsx` | Gallery/credential image grid |
| `src/components/TrainerImageCarousel.tsx` | Horizontal image carousel |
| `src/components/schedule/MonthCalendar.tsx` | Monthly calendar with slot indicators |
| `src/components/schedule/SchedulePrimitives.tsx` | Schedule cards, badges, day pills, bottom sheet |
| `src/components/onboarding/TourContext.tsx` | Coach-mark tour engine (context + target registration) |
| `src/components/onboarding/CoachMark.tsx` | Tour overlay (spotlight, tooltip, navigation) |
| `src/components/onboarding/TourGate.tsx` | Auto-starts pending tours |
| `src/components/onboarding/clientTour.ts` | 7-step client onboarding tour |
| `src/components/onboarding/trainerTour.ts` | 5-step trainer onboarding tour |

### Feature slices (`features/`)

| Path | What |
|------|------|
| `features/auth/authSlice.ts` | Auth state (user, token, trainer profile) |
| `features/auth/authApiSlice.ts` | Login, signup, forgot/reset password, roles |
| `features/trainer/trainerApiSlice.ts` | Trainer CRUD, search, specializations, analytics, images |
| `features/trainer/TrainerProfile.tsx` | Trainer profile screen (large file, ~1350 lines) |
| `features/users/usersApiSlicet.ts` | User CRUD, create-trainer, profile deletion (note: typo in filename) |
| `features/users/CreateTrainer.tsx` | Create trainer form component |
| `features/users/UserList.tsx` | (unused/old) |
| `features/gym/gymApiSlice.ts` | Gym CRUD, join/leave, availability |
| `features/schedule/scheduleApiSlice.ts` | Working hours, slots, generate, block, assign, check-in codes |
| `features/billing/billingApiSlice.ts` | IAP validation, entitlement, transactions |
| `features/review/reviewApiSlice.ts` | Trainer reviews CRUD |
| `features/recommendations/recommendationApiSlice.ts` | Suggested trainers, client preferences |
| `features/support/issueApiSlice.ts` | Issue reporting + admin management |
| `features/onboarding/onboardingSlice.ts` | Tour completion tracking |

### i18n system
- Toggle in profile 3-dots menu (both UserProfile and TrainerProfile)
- `useLanguage()` hook → `{ t, language, setLanguage }`
- `t("key")` returns translated string, falls back to key if missing
- Language persisted in AsyncStorage under key `app_language`
- All 25 screen files use translations; tour steps use `titleKey`/`bodyKey`/`hintKey`

### Key architectural notes
- **New Architecture disabled** (`newArchEnabled: false` in app.json + expo-build-properties) due to react-native-maps marker clipping bug (upstream #5877)
- **No Dark Mode** — `userInterfaceStyle: "light"`, single light theme, many inline colors
- Redux Toolkit + RTK Query for state + API calls
- redux-persist for auth token persistence
- RevenueCat for iOS/Android subscriptions; Stripe gated off on native
- expo-location for foreground-only location (map centering)
- expo-image-picker for photos

## Backend (`server/`)

Express + TypeScript, PostgreSQL (via raw SQL or an ORM — check `db.ts`).

### Entry & config
- `src/index.ts` — Express app entry
- `src/db.ts` — Database connection
- `src/config/env.ts` — Environment variables
- `src/config/security.ts` — Security settings
- `src/config/stripe.ts` — Stripe config
- `src/config/s3.ts` — S3 (image storage) config
- `src/config/email.ts` — Email config
- `src/config/billingMode.ts` — Billing mode toggle
- `src/config/billingPlans.ts` — Subscription plan definitions

### Routes (`src/routes/`)
`index.ts` mounts all sub-routers:
- `auth` — login, signup, forgot/reset password, token refresh
- `user` — profile CRUD, profile picture, deletion
- `trainer` — trainer profiles, search, analytics
- `trainerSpecialization` — trainer↔specialization links
- `trainerImages` — gallery + credential image upload
- `trainerSchedule` — working hours, slot generation, assignment, blocking
- `gym` — gym CRUD, join/leave, availability
- `review` — trainer reviews
- `billing` — IAP validation, entitlement check, transactions
- `recommendation` — suggested trainers based on preferences
- `issue` — user issue reports + admin management
- `email` — email verification
- `specialization` — specialization list

### Controllers (`src/controllers/`)
One controller per route module, same names as routes.

### Models (`src/models/`)
- `user.ts`, `trainer.ts`, `gym.ts`, `review.ts`, `issue.ts`
- `trainerScheduleSlot.ts`, `trainerWorkingHour.ts`, `trainerBlockedDate.ts`
- `trainerGym.ts`, `trainerSpecialization.ts`, `trainerImage.ts`
- `specialization.ts`, `clientCheckInCode.ts`, `clientPreference.ts`
- `billingTransaction.ts`, `billingWebhookEvent.ts`
- `profileViewEvent.ts`, `refreshToken.ts`

### Middleware
- `auth.ts` — JWT verification
- `authorization.ts` — Role-based access
- `subscription.ts` — Subscription gating
- `rateLimit.ts` / `rateLimitProfiles.ts` — Rate limiting
- `validation.ts` — Request validation
- `errorHandler.ts` — Global error handler

### Services
- `emailService.ts` / `emailTemplate.ts` — Transactional emails
- `s3ImageService.ts` / `imageProcessor.ts` — Image upload + processing
- `entitlement.ts` — Subscription entitlement logic
- `profileViewTracking.ts` — Trainer analytics tracking
- `googlePlacesImport.ts` — Gym data import
- `databaseBootstrap.ts` — DB init/seeding

### Seeds
- `specializationSeed.ts` — Default specializations
- `trainerSpecializationSeed.ts` — Seed data
- `gymSeed.ts` — Gym seed data

## Docs (`docs/`)

- `app-store-review-audit.md` — App Store review pre-submission audit (§1-§5)
- `licenta-fmi/` — Bachelor's thesis (LaTeX, Romanian)

# TypeScript Project

This project uses TypeScript with strict configuration.

## TypeScript Configuration
- Strict mode enabled
- No implicit any
- Strict null checks
- ES modules

## Type Conventions
- Prefer interfaces for object shapes
- Use type aliases for unions/intersections
- Export types alongside implementations
- Avoid `any` - use `unknown` if type is truly unknown

## Patterns
- Use discriminated unions for state
- Prefer readonly arrays and objects where applicable
- Use generics for reusable type-safe functions
- Leverage utility types (Partial, Required, Pick, Omit)

## Code Style
- Use explicit return types for exported functions
- Use const assertions for literal types
- Prefer nullish coalescing (??) over OR (||)
- Use optional chaining (?.) for safe property access

## File Organization
- One export per file when possible
- Co-locate types with implementations
- Use barrel exports (index.ts) for public APIs

## Commands
- `npm run build` - Compile TypeScript
- `npm run typecheck` - Check types without emitting
- `npm run lint` - Run ESLint with TypeScript rules

