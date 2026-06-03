# Trainee App - System Architecture

## Technical Stack
* **Frontend**: React Native, Expo, Redux Toolkit (RTK Query), `redux-persist` for session retention.
* **Backend**: Node.js, Express, TypeScript, Sequelize (PostgreSQL ORM).
* **Database**: PostgreSQL (using PostGIS spatial extensions for geo-proximity searches).
* **Payments/Billing**: RevenueCat (In-App Purchases) & Stripe (Web hook syncing).

## Directory Structure Map

```text
Trainee-dev/
├── docs/                     # Global project documentation
├── frontend/                 # Expo React Native App
│   ├── app/                  # Expo Router file-based screens
│   ├── features/             # Redux feature slices (auth, billing, trainer)
│   ├── src/                  # Shared assets, config, and global hooks
│   └── package.json
└── server/                   # Express REST API
    ├── src/
    │   ├── config/           # App/DB configurations
    │   ├── controllers/      # Route logic handlers
    │   ├── middleware/       # JWT auth, rate limits, validation
    │   ├── models/           # Sequelize ORM schema definitions
    │   ├── routes/           # REST endpoints
    │   └── utils/            # JWT, responses, email helpers
    └── package.json
```

## Authentication & Authorization Model
* **Mechanism**: JSON Web Tokens (JWT) signed via `JWT_SECRET`.
* **Access Control**: Handled using `authenticate` middleware in Express that parses the `Authorization: Bearer <Token>` header.
* **Session Storage**: Access token and user profiles are stored in Redux and persisted locally in React Native via `redux-persist` and `AsyncStorage` for seamless app cold starts.

## Data Persistence & Models
The relational database operates with the following primary models:
1. `User`: Core authentication entity (clients, trainers, admins).
2. `Trainer`: Trainer profiles, location coordinates (PostGIS points), rates, bio, and subscription fields.
3. `Gym`: Gym listings matching latitude/longitude coordinates.
4. `Review`: Client reviews for trainers.
5. `BillingTransaction`: Local logs recording RevenueCat webhooks and direct Stripe checkouts.
6. `BillingWebhookEvent`: Log of raw payloads received from external payment providers.
