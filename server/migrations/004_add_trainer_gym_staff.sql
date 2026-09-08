-- Gym-staff affiliation on trainer_gyms: a trainer requests it, an admin
-- approves, and approved trainers sort into their own section at the top of
-- the gym's map pin.
--
-- Why a manual SQL file: the app boots with sequelize.sync({ alter: false }), so
-- new columns are NOT added automatically on an existing database. Run this once
-- per environment BEFORE deploying the build that uses it, or every gym query
-- starts erroring on a missing column.
--
-- Local:  docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" < migrations/004_add_trainer_gym_staff.sql
-- Prod:   same, against the production db container (see server/DEPLOY.md).
--
-- Idempotent: safe to run multiple times.

-- Sequelize resolves a model's ENUM to a type named enum_<table>_<column>.
DO $$ BEGIN
  CREATE TYPE enum_trainer_gyms_staff_status
    AS ENUM ('none', 'pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE trainer_gyms
  ADD COLUMN IF NOT EXISTS staff_status enum_trainer_gyms_staff_status
    NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS staff_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS staff_reviewed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS staff_reviewed_by  INTEGER
    REFERENCES users (id) ON DELETE SET NULL;

-- The read path only ever filters for approved rows.
CREATE INDEX IF NOT EXISTS trainer_gyms_gym_staff_idx
  ON trainer_gyms (gym_id) WHERE staff_status = 'approved';
