# Trainer Custom Packages — Design Spec

## Overview

Replace the current flat hourly/session rate pricing with a custom package system. Trainers create up to 5 packages (name, price, session count). The `sessionRate` field is auto-calculated as the lowest per-session price across all packages. Packages are display-only — no in-app payments; payment happens outside the app.

The `hourlyRate` field is hidden from the UI but retained in the database.

## Data Model

### New table: `trainer_packages`

| Column         | Type           | Constraints                          |
|----------------|----------------|--------------------------------------|
| `id`           | INTEGER        | PK, auto-increment                   |
| `trainer_id`   | INTEGER        | FK → trainers, NOT NULL, ON DELETE CASCADE |
| `name`         | VARCHAR(100)   | NOT NULL                             |
| `price`        | DECIMAL(7,2)   | NOT NULL, > 0                        |
| `session_count`| INTEGER        | NOT NULL, >= 1                       |
| `sort_order`   | INTEGER        | NOT NULL, default 0                  |
| `created_at`   | TIMESTAMP      | Sequelize default                    |
| `updated_at`   | TIMESTAMP      | Sequelize default                    |

### Constraints

- Max 5 packages per trainer (enforced in controller).
- `session_count` >= 1.
- `price` > 0.

### Session rate calculation

On every package write (create, update, delete):

1. Query all packages for the trainer.
2. Compute `MIN(price / session_count)`.
3. Update `trainer.sessionRate` with the result.
4. If no packages remain, set `trainer.sessionRate` to `NULL`.

### Existing fields

- `hourlyRate`: retained in database, hidden from all UI.
- `sessionRate`: becomes auto-calculated, read-only in UI.

## Backend API

New route group: `/trainer-packages`

| Method   | Path                          | Auth           | Description                                      |
|----------|-------------------------------|----------------|--------------------------------------------------|
| `GET`    | `/trainer-packages/:trainerId`| Public         | List all packages for a trainer (by `sort_order`) |
| `POST`   | `/trainer-packages`           | Trainer (own)  | Create a package (reject if already at 5)         |
| `PUT`    | `/trainer-packages/:id`       | Trainer (own)  | Update a package                                  |
| `DELETE` | `/trainer-packages/:id`       | Trainer (own)  | Delete a package                                  |

### Validation

- `name`: required, string, max 100 characters.
- `price`: required, number, > 0.
- `sessionCount`: required, integer, >= 1.
- `sortOrder`: optional, integer, default 0.

### Session rate recalculation

Every write endpoint (POST, PUT, DELETE) recalculates `sessionRate` after the operation. This follows the same pattern as `trainerImages` — separate model, own route/controller, trainer ownership check via auth middleware.

## Frontend Changes

### New API slice

`features/trainer/trainerPackageApiSlice.ts`:

- `useGetTrainerPackagesQuery(trainerId)` — fetch packages.
- `useCreateTrainerPackageMutation()` — create a package.
- `useUpdateTrainerPackageMutation()` — update a package.
- `useDeleteTrainerPackageMutation()` — delete a package.

### Trainer Profile (edit mode)

Replace hourly/session rate inputs with a "My Packages" section:

- List existing packages: name, sessions, price, computed per-session rate.
- "Add Package" button (disabled at 5).
- Edit/delete each package inline or via modal.
- Session rate shown as read-only, auto-calculated.

### Trainer Profile (view mode)

Replace hourly/session rate display with a packages list showing name, sessions, price, and computed per-session rate.

### CreateTrainer form

Replace `hourlyRate` and `sessionRate` inputs with the ability to add at least one package during trainer creation.

### Trainer detail page (`trainers/[id].tsx`)

Replace the "Experience & Rates" pricing section with a packages list. Show computed session rate as a summary (e.g., "From $25/session").

### Search page

No changes needed. Existing `minRate`/`maxRate` filters continue to work against the auto-calculated `sessionRate`.

### Hidden from UI

`hourlyRate` removed from: CreateTrainer, TrainerProfile (edit + view), trainer detail page, and any search filters referencing it.

### i18n

New translation keys added for both EN and RO:

- Package-related labels (name, price, sessions, per-session rate).
- Validation messages (max packages, required fields).
- UI strings ("Add Package", "My Packages", "From $X/session", etc.).
