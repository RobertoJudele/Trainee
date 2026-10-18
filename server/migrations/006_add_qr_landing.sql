-- Trainer QR landing page rework: a per-view poster scan log.
--
-- Like 005: sequelize.sync() creates this table on boot anyway; this file
-- exists so the schema is explicit and applied ahead of the deploy. Run once
-- per environment.
--
-- Local:  docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" < migrations/006_add_qr_landing.sql
-- Prod:   same, against the production db container (see server/DEPLOY.md).
--
-- Idempotent: safe to run multiple times.

BEGIN;

DO $$ BEGIN
  CREATE TYPE enum_poster_scan_events_device AS ENUM ('ios', 'android', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS poster_scan_events (
  id              SERIAL PRIMARY KEY,
  poster_code_id  INTEGER NOT NULL REFERENCES poster_codes(id) ON DELETE CASCADE,
  gym_id          INTEGER NULL REFERENCES gyms(id) ON DELETE SET NULL,
  device          enum_poster_scan_events_device NOT NULL,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS poster_scan_events_gym_id_created_at
  ON poster_scan_events (gym_id, created_at);

COMMIT;
