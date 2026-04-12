# Trainee

Full-stack fitness trainer marketplace with a React Native (Expo) client and a Node.js/Express + PostgreSQL backend.

## Overview

Trainee connects clients with trainers. Core capabilities include:

- Authentication and role-based access (client, trainer, admin)
- Trainer discovery and profile browsing
- Gym management
- Gym map marker clustering for dense areas
- Trainer schedule generation and assignment flow
- Client check-in code workflow for trainer scheduling
- Billing integration (Stripe)
- Image upload support (AWS S3)
- Issue reporting

## Monorepo Structure

```text
.
|- frontend/   Expo Router React Native app
|- server/     Express + Sequelize TypeScript API
`- README.md
```

### Frontend high-level structure

```text
frontend/
|- app/                    Expo Router screens and route groups
|- features/               RTK Query slices and feature modules
|- src/
|  |- api/                 Base API slice and auth reauth flow
|  |- components/          Reusable UI pieces
|  |- constants/           App constants including API URL
|  |- lib/                 Theme and shared utilities
|  |- screens/             Legacy or shared screen modules
|  `- types/               Frontend TypeScript types
`- package.json
```

### Backend high-level structure

```text
server/
|- src/
|  |- config/              Stripe, email, S3 configuration
|  |- controllers/         Route handlers
|  |- middleware/          Auth and request guards
|  |- models/              Sequelize models
|  |- routes/              Express routers
|  |- seeds/               Seed scripts
|  |- services/            Service-layer helpers
|  |- types/               Backend TypeScript types
|  `- utils/               Utility helpers
`- package.json
```

## Tech Stack

### Frontend

- Expo + React Native + TypeScript
- Expo Router
- Redux Toolkit + RTK Query
- AsyncStorage
- Stripe React Native SDK

### Backend

- Node.js + Express + TypeScript
- Sequelize (sequelize-typescript) + PostgreSQL
- PostGIS (geospatial storage + distance queries)
- pg_trgm (trigram text search acceleration)
- JWT auth
- Nodemailer (SMTP)
- Stripe
- AWS S3 (uploads)

## Current Runtime Behavior

- Backend default port: `8000` (from `PORT`, fallback 8000)
- Frontend API URL is set in `frontend/src/constants/config.ts`
- Frontend uses IP-based API URL in development
- Backend startup runs idempotent DB bootstrap for `postgis`/`pg_trgm`, syncs models, backfills spatial columns, and ensures GiST/GIN indexes

## Prerequisites

- Node.js 18+
- npm
- PostgreSQL running locally or reachable remotely
- PostgreSQL with permission to enable `postgis` and `pg_trgm` extensions
- Expo-compatible environment (Expo Go or emulator/simulator)

## Environment Variables

Create `server/.env` with at least:

```env
PORT=8000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=trainee
DB_USER=postgres
DB_PASS=your_password

JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_password_or_app_password

# Billing runtime mode
BILLING_MODE=revenuecat_only

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

REVENUECAT_SECRET_API_KEY=rc_secret_...
REVENUECAT_WEBHOOK_AUTH=your_webhook_auth_value
REVENUECAT_ENTITLEMENT_ID=trainer_subscription

AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=...
AWS_S3_BUCKET=...

CHECKIN_CODE_SECRET=your_checkin_secret
```

Frontend billing keys (Expo):

```env
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY=appl_...
EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY=goog_...
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=trainer_subscription
EXPO_PUBLIC_REVENUECAT_PRODUCT_ID=com.trainee.trainer_monthly
EXPO_PUBLIC_ENABLE_STRIPE_CHECKOUT=0
```

Note:

- Frontend currently reads API URL from `frontend/src/constants/config.ts` (not from env)
- Update the local IP in that file when your network changes
- Real RevenueCat purchase testing requires an Expo development build (Expo Go preview mode does not execute real store purchases)

## Setup and Run

### 1. Install dependencies

```bash
cd server
npm install

cd ../frontend
npm install
```

### 2. Start backend

```bash
cd server
npm run dev
```

TypeScript note:

- Backend `tsconfig.json` keeps `baseUrl` for existing `src/...` imports and sets `ignoreDeprecations: "6.0"` to prevent TypeScript 6 from failing startup.

### 3. Start frontend

```bash
cd frontend
npm start
```

Useful frontend commands:

```bash
npm run android
npm run ios
npm run web
```

## Available Scripts

### Backend (`server/package.json`)

- `npm run dev` - start API using ts-node-dev
- `npm run seed:gyms` - seed gyms (fallback sample data by default)
- `npm run seed:specializations` - seed specialization records
- `npm run seed:trainer-specializations` - seed trainer-specialization relations

Important:

- There is currently no `build` script in backend `package.json`

Gym import modes for Romania:

- Google Places import (primary): set `IMPORT_GOOGLE_PLACES_ROMANIA=1` and `GOOGLE_PLACES_API_KEY`.
- PowerShell example:

```powershell
cd server
$env:IMPORT_GOOGLE_PLACES_ROMANIA = "1"
$env:GOOGLE_PLACES_API_KEY = "<your-google-api-key>"
npm run seed:gyms
```

- Google importer runs Romania-wide grid batching, paginates results, retries transient API failures, deduplicates entries, country-verifies each place via Google Place Details, and stores results in the `gyms` table used by the app map.
- Optional Google tuning env vars: `GOOGLE_PLACES_MAX_RETRIES`, `GOOGLE_PLACES_REQUEST_TIMEOUT_MS`, `GOOGLE_PLACES_REQUEST_PAUSE_MS`, `GOOGLE_PLACES_PAGE_TOKEN_WAIT_MS`, `GOOGLE_PLACES_RADIUS_METERS`, `GOOGLE_PLACES_GRID_STEP_DEGREES`, `GOOGLE_PLACES_MAX_PAGES_PER_CELL`, `GOOGLE_PLACES_MAX_CELLS`, `GOOGLE_PLACES_FETCH_DETAILS`.
- `GOOGLE_PLACES_FETCH_DETAILS=0` still fetches minimal details for country verification (RO-only safety) and skips phone/opening-hours enrichment.
- Legacy OSM import is still available when `IMPORT_OSM_ROMANIA=1` is set.
- If both Google and OSM flags are enabled, Google mode takes precedence (set `IMPORT_OSM_ROMANIA=0` to remove the warning).
- If no import flag is set, the seed uses built-in fallback sample gyms.
- OSM resilience env vars: `OSM_OVERPASS_URL`, `OSM_OVERPASS_URLS` (comma-separated mirrors), `OSM_MAX_RETRIES`, `OSM_REQUEST_TIMEOUT_MS`, `OSM_REQUEST_PAUSE_MS`.
- No external POI provider guarantees perfect real-world completeness; plan for periodic re-imports and optional manual augmentation for missing gyms.

### Frontend (`frontend/package.json`)

- `npm start`
- `npm run android`
- `npm run ios`
- `npm run web`

## API Routing Summary

All API routers are mounted from backend root router:

- `/auth`
- `/users`
- `/email`
- `/reviews`
- `/trainer`
- `/trainer-images`
- `/specialization`
- `/trainer-specializations`
- `/gyms`
- `/billing`
- `/issues`
- `/trainer-schedule`

Geospatial query support:

- `GET /gyms?lat=<number>&lng=<number>&radiusKm=<number>`
	- filters gyms by radius and sorts by distance when `lat`/`lng` are provided
- `GET /trainer/search?...&lat=<number>&lng=<number>&radius=<number>&sortBy=distance`
	- filters trainers by radius and can sort by geospatial distance

Backward-compatible billing paths also exist:

- `/create-checkout-session`
- `/create-portal-session`

Billing webhooks:

- `/billing/webhook` (Stripe)
- `/billing/webhooks/revenuecat` (RevenueCat)

## Public IDs and Security

- Trainer profiles now use a non-incremental public UUID (`public_id`) for public-facing lookup flows.
- Public trainer details endpoint (`GET /trainer/:trainerId`) accepts trainer public UUIDs.
- Trainer search responses expose trainer `id` as the public UUID and include `internalId` for internal compatibility flows.
- Issue reporting supports both legacy numeric `trainerId` and secure `trainerPublicId`.
- Incremental numeric IDs are still used internally for relational integrity in the database.

## Trainer Scheduling Feature (Current)

- Trainer weekly/day schedule views in frontend
- Client assignment uses check-in code based workflow
- Weekly schedule supports real drag-and-drop assignment:
	- trainer adds a client to drag list by resolving a real 6-digit client code
	- resolved clients are saved locally per trainer account for future sessions and can be reused later even after the original code expires
	- drag client chip over an `available` slot to assign the saved client directly by `clientId`
	- dragging uses a floating overlay chip rendered above all cards to avoid going behind calendar columns
	- weekly scroll is temporarily disabled while dragging to keep chip movement attached to finger on mobile devices
	- hovered slot highlight and assign loading feedback are shown in UI
	- no hardcoded/mock client list is used
- Day schedule also supports drag-and-drop assignment flow
- Slot status management (available, assigned, completed, canceled, no_show)

## Gym Map UX (Current)

- The map fetches nearby gyms based on current map center and adaptive radius (`lat`, `lng`, `radiusKm`) instead of loading all gyms at once.
- Nearby gym markers are clustered at lower zoom levels to prevent overlap
- Tapping a cluster zooms in to expand into smaller clusters or individual gyms
- Tapping an individual gym marker keeps the existing bottom-sheet details flow
- Rapid marker taps are throttled and recenter animations are guarded to avoid request/animation storms.
- Programmatic recenter after marker tap does not trigger an extra nearby refetch; nearby refetch is driven by meaningful user map movement.
- While a gym detail sheet is active, map region-driven nearby refetch updates are deferred and applied after the selection is closed.
- In dense-city areas, the map filters clustering input to a buffered viewport window and limits maximum marker render count to keep panning stable.
- Cluster cells are globally anchored so small map pans do not reshuffle all cluster keys every frame.
- Dense clusters increase bucket size automatically, and tiny rapid map movements are cooldown-throttled before applying new fetch/render regions.

## Home Feed UX (Current)

- Top Rated Trainers on Home is intentionally capped to 5 cards for faster scan and reduced feed length
- Each Top Rated trainer card is tappable and opens the trainer details route (`/trainers/[id]`)
- "See All" in the Top Rated section still navigates to full trainer search

## Trainer Profile UX (Current)

- Bottom-heavy action blocks were collapsed into a clean unified top-right Dropdown navigation modal.
- Active actions (Edit, Manage Subscription, Log Out, Delete Profile) are hidden in the dropdown unless invoked.
- Bottom actions are strictly contextual, displaying 'Save' and 'Cancel' safely during edit mode natively.

## Trainer Social Contact UX (Current)

- Trainer profiles now support optional social links for Instagram, Facebook, and WhatsApp.
- Trainers can add, update, or clear these social contacts from their profile editor.
- WhatsApp contact is stored as an international phone number (or compatible WhatsApp link that includes a phone number).
- Public trainer details (`/trainers/[id]`) show a single Contact button only when at least one social link is available.
- Tapping Contact opens a chooser with available platforms; WhatsApp tries to open direct in-app chat with the trainer first.
- Backend validation enforces safe platform formats: URL/domain checks for Instagram/Facebook and phone-or-WhatsApp-link checks for WhatsApp.

## Auth Model

- JWT bearer tokens
- Backend `authenticate` middleware protects secured routes
- Role-based behavior implemented at controller level (`client`, `trainer`, `admin`)

## Billing Mode (Current)

- RevenueCat is the active billing runtime for trainer subscriptions in this release.
- Stripe code paths are intentionally preserved in backend and frontend for future reactivation.
- Stripe runtime actions are currently disabled by billing mode guards (`BILLING_MODE=revenuecat_only`).
- Backend tracks subscription source (`none`, `stripe`, `apple`, `google`) and IAP metadata fields on trainer profiles.
- Authenticated billing endpoints:
	- `GET /billing/entitlement` returns normalized subscription entitlement state.
	- `POST /billing/iap/validate` and `POST /billing/revenuecat/sync` sync RevenueCat-backed mobile subscription state.
- RevenueCat webhook ingestion endpoint:
	- `POST /billing/webhooks/revenuecat` supports auth-header validation and idempotent event processing.
- Subscription gating middleware resolves entitlement through a unified service, and trainer update routes enforce subscription checks before applying updates.

## Known Notes

- Backend startup currently includes `sequelize.sync({ alter: true })`; use caution in production
- Backend startup also seeds specializations automatically
- Spatial migration is backward-compatible: legacy `latitude`/`longitude` are still returned while PostGIS `location` is used for proximity queries
- Some debug logging is enabled for DB/API flows

## Suggested Next Improvements

- Add backend scripts for `build`, `typecheck`, and `test`
- Add `.env.example` files for frontend and backend
- Move frontend API URL/IP selection to environment config
- Add API docs (OpenAPI/Swagger)
- Add CI checks for linting and type safety
