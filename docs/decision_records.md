# Architectural Decision Records (ADR)

This document tracks technical decisions, justifications, and implications for the Trainee project.

---

## ADR 1: Session Retention Mechanism
* **Status**: Approved
* **Context**: We need to keep clients/trainers logged in across app restarts so they do not have to type credentials every time they reopen the app.
* **Decision**: We selected `redux-persist` combined with `@react-native-async-storage/async-storage` targeting only the `auth` Redux slice.
* **Rationale**:
  * Seamlessly preserves the credentials (`user` and `token` state) in persistent memory.
  * RTK Query cache (`apiSlice`) is explicitly excluded to prevent stale API network data from surfacing on cold start.
  * PersistGate is registered in `_layout.tsx` to delay rendering until the store is rehydrated, avoiding flash-of-welcome screen state.

---

## ADR 2: Subscription Sharing Prevention
* **Status**: Approved
* **Context**: Subscriptions bought on iOS/Android could be shared across multiple Trainee accounts if a device was shared or logged out.
* **Decision**: Configured RevenueCat **Restore Behavior** to **Keep with original App User ID**.
* **Rationale**:
  * Safely ties the Apple ID/Google Play subscription receipt permanently to the first Trainee App User ID.
  * Attempts to restore/purchase using the same device receipt on a different logged-in email profile throws `ReceiptAlreadyInUseError`.
  * Frontend caught cases show standard prompts instructing the user to log back into their primary subscription account.

---

## ADR 3: DB Partitioning of Local Data on Devices
* **Status**: Approved
* **Context**: Offline scheduler and client layout tools write to local storage (`AsyncStorage`). If multiple users share the same mobile phone, user A's schedules must never be visible to user B.
* **Decision**: Storage keys are prefixed and parameterized using `user.id`.
* **Rationale**:
  * e.g., keys like `dragClientsStorageKey(user.id)` and `savedClientsStorageKey(user.id)`.
  * Avoids complex database cleanups or multi-user cross-contamination bugs on logout/login.
