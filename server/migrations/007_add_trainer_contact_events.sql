-- Trainer contact tracking: one row per tap on a trainer's WhatsApp /
-- Instagram / Facebook button in the app, plus the timestamp of the one-off
-- "contacted by 5 people" conversion alert.
--
-- Must run BEFORE the deploy: sequelize.sync() would create the new table on
-- boot, but it does NOT add the new column to the existing trainer_profiles
-- table (alter is off), and every trainer query would then fail.
--
-- Local:  docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" < migrations/007_add_trainer_contact_events.sql
-- Prod:   same, against the production db container (see server/DEPLOY.md).
--
-- Idempotent: safe to run multiple times.

BEGIN;

ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS contact_alert_sent_at TIMESTAMP WITH TIME ZONE NULL;

DO $$ BEGIN
  CREATE TYPE enum_trainer_contact_events_channel AS ENUM ('whatsapp', 'instagram', 'facebook');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS trainer_contact_events (
  id               SERIAL PRIMARY KEY,
  trainer_id       INTEGER NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
  contact_user_id  INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  contact_ip       VARCHAR(64) NOT NULL,
  channel          enum_trainer_contact_events_channel NOT NULL,
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trainer_contact_events_trainer_id_contact_user_id
  ON trainer_contact_events (trainer_id, contact_user_id);

COMMIT;
