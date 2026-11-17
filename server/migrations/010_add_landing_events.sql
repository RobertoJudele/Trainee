-- Trainer landing page (/antrenori): a per-view and per-click log.
--
-- Like 005 and 006: sequelize.sync() creates this table on boot anyway; this
-- file exists so the schema is explicit and applied ahead of the deploy. Run
-- once per environment.
--
-- Local:  docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" < migrations/010_add_landing_events.sql
-- Prod:   same, against the production db container (see server/DEPLOY.md).
--
-- Idempotent: safe to run multiple times.

BEGIN;

DO $$ BEGIN
  CREATE TYPE enum_landing_events_kind AS ENUM ('visit', 'click');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_landing_events_target AS ENUM ('ios', 'android', 'instagram');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_landing_events_device AS ENUM ('ios', 'android', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS landing_events (
  id          SERIAL PRIMARY KEY,
  kind        enum_landing_events_kind NOT NULL,
  target      enum_landing_events_target NULL,
  position    VARCHAR(16) NULL,
  source      VARCHAR(24) NULL,
  device      enum_landing_events_device NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS landing_events_created_at
  ON landing_events (created_at);

COMMIT;
