-- Adds the `category` column to trainer_images.
--
-- Why a manual SQL file: the app boots with sequelize.sync({ alter: false }) and
-- has no migration framework, so a new model column is NOT applied to an existing
-- table automatically. Run this once per environment.
--
-- Local:  docker compose exec db psql -U "$DB_USER" -d "$DB_NAME" -f /migrations/001_add_trainer_image_category.sql
--   (or just paste the statement into a psql shell)
-- Prod:   same, against the production db container (see server/DEPLOY.md).
--
-- Idempotent: safe to run multiple times.

ALTER TABLE trainer_images
  ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'gallery';

-- Existing rows (legacy "primary" profile pictures, if any) default to 'gallery'.
-- Profile pictures are no longer stored in this table going forward.
