-- Per-gym poster QR codes and their scan / store-click counters.
--
-- Why a manual SQL file: sequelize.sync({ alter: false }) DOES create this table
-- on boot (sync issues CREATE TABLE IF NOT EXISTS for every registered model
-- regardless of `alter`; `alter` only governs ALTERs to existing tables). This
-- file exists so the schema is explicit, reviewable, and applied deterministically
-- ahead of the deploy rather than as a side effect of process start. Run this once
-- per environment.
--
-- Local:  docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" < migrations/005_add_poster_codes.sql
-- Prod:   same, against the production db container (see server/DEPLOY.md).
--
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS poster_codes (
  id                SERIAL PRIMARY KEY,
  code              VARCHAR(32)  NOT NULL UNIQUE,
  label             VARCHAR(120) NOT NULL,
  gym_id            INTEGER      NULL REFERENCES gyms(id) ON DELETE SET NULL,
  gym_logo_url      VARCHAR(500) NULL,
  scan_count        INTEGER      NOT NULL DEFAULT 0,
  apple_click_count INTEGER      NOT NULL DEFAULT 0,
  play_click_count  INTEGER      NOT NULL DEFAULT 0,
  last_scanned_at   TIMESTAMP WITH TIME ZONE NULL,
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Every scan looks the row up by code.
CREATE INDEX IF NOT EXISTS poster_codes_code_idx ON poster_codes (code);
