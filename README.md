# Trainee

Full-stack fitness trainer marketplace with a React Native (Expo) client and a Node.js/Express + PostgreSQL backend.

## Overview

Trainee connects clients with trainers. Core capabilities include:

- Authentication and role-based access (client, trainer, admin)
- Trainer discovery and profile browsing
- Gym management
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
- JWT auth
- Nodemailer (SMTP)
- Stripe
- AWS S3 (uploads)

## Current Runtime Behavior

- Backend default port: `8000` (from `PORT`, fallback 8000)
- Frontend API URL is set in `frontend/src/constants/config.ts`
- Frontend uses IP-based API URL in development
- Backend currently runs `sequelize.sync({ alter: true })` on startup and seeds specializations

## Prerequisites

- Node.js 18+
- npm
- PostgreSQL running locally or reachable remotely
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

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=...
AWS_S3_BUCKET=...

CHECKIN_CODE_SECRET=your_checkin_secret
```

Frontend Stripe key (Expo):

```env
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Note:

- Frontend currently reads API URL from `frontend/src/constants/config.ts` (not from env)
- Update the local IP in that file when your network changes

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
- `npm run seed:specializations` - seed specialization records
- `npm run seed:trainer-specializations` - seed trainer-specialization relations

Important:

- There is currently no `build` script in backend `package.json`

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

Backward-compatible billing paths also exist:

- `/create-checkout-session`
- `/create-portal-session`

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

## Auth Model

- JWT bearer tokens
- Backend `authenticate` middleware protects secured routes
- Role-based behavior implemented at controller level (`client`, `trainer`, `admin`)

## Known Notes

- Backend startup currently includes `sequelize.sync({ alter: true })`; use caution in production
- Backend startup also seeds specializations automatically
- Some debug logging is enabled for DB/API flows

## Suggested Next Improvements

- Add backend scripts for `build`, `typecheck`, and `test`
- Add `.env.example` files for frontend and backend
- Move frontend API URL/IP selection to environment config
- Add API docs (OpenAPI/Swagger)
- Add CI checks for linting and type safety
