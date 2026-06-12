# Trainee App - API Map

A comprehensive checklist map of the backend REST endpoints.

---

## 🔑 Authentication Endpoints (`/auth`)

* **`POST /auth/register`**
  * **Auth**: Public
  * **Payload**: `{ email, password, firstName, lastName, phone, role }`
  * **Response**: Standardized `AuthResponse` containing user details and jwt token.

* **`POST /auth/login`**
  * **Auth**: Public
  * **Payload**: `{ email, password }`
  * **Response**: Standardized `AuthResponse`.

* **`POST /auth/forgot-password`**
  * **Auth**: Public
  * **Payload**: `{ email }`
  * **Response**: Confirmation message (standardized response).

* **`POST /auth/reset-password`**
  * **Auth**: Public
  * **Payload**: `{ token, newPassword }`
  * **Response**: Success status.

* **`GET /auth/profile`**
  * **Auth**: Authenticated (JWT Header `Authorization: Bearer <token>`)
  * **Response**: Current user profile metadata.

---

## 🏋️ Trainer Endpoints (`/trainer`)

* **`GET /trainer/search`**
  * **Auth**: Public
  * **Query Params**: `?sortBy=totalRating&sortOrder=desc&limit=5...`
  * **Response**: Array of trainers matched to filters.

* **`GET /trainer/analytics`**
  * **Auth**: Authenticated (Trainer only)
  * **Response**: Booking stats and views.

* **`GET /trainer/:trainerId`**
  * **Auth**: Public
  * **Response**: Single trainer profile details (including specs/reviews).

* **`POST /trainer/create`**
  * **Auth**: Authenticated
  * **Payload**: `{ bio, experienceYears, hourlyRate, sessionRate, locationCity, locationState... }`
  * **Response**: Created trainer profile data.

* **`GET /trainer`**
  * **Auth**: Authenticated
  * **Response**: Self trainer profile.

* **`PUT /trainer`**
  * **Auth**: Authenticated + Requires Active Subscription middleware
  * **Payload**: Updated trainer metadata fields.
  * **Response**: Updated trainer profile.

* **`DELETE /trainer`**
  * **Auth**: Authenticated
  * **Response**: Success/Failure status.

---

## 💳 Billing & Payment Endpoints (`/billing`)

* **`POST /billing/subscribe`**
  * **Auth**: Authenticated
  * **Response**: Initialized session details.

* **`GET /billing/entitlement`**
  * **Auth**: Authenticated
  * **Response**: Current subscription status (`active`, `canceled`, etc.).

* **`GET /billing/transactions`**
  * **Auth**: Authenticated
  * **Response**: Array of local billing transaction records.

* **`POST /billing/iap/validate`**
  * **Auth**: Authenticated
  * **Payload**: `{ productId, transactionId, originalTransactionId }`
  * **Response**: Verification result state.

* **`POST /billing/revenuecat/sync`**
  * **Auth**: Authenticated
  * **Payload**: Identical parameters as receipt validate triggers.

* **`POST /billing/webhook`**
  * **Auth**: Webhook Verification Signature (Stripe)
  * **Payload**: Raw stripe webhook payload.

* **`POST /billing/webhooks/revenuecat`**
  * **Auth**: Webhook API Header Key (RevenueCat)
  * **Payload**: Raw RevenueCat webhook event body.
