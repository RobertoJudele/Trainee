-- Password reset by 6-digit emailed code (replaces the emailed JWT link).
--
-- A new table only: sequelize.sync() would create it on boot anyway, so this
-- does not have to run before the deploy. It exists so the schema is explicit,
-- like 005-007. Run once per environment.
--
-- Local:  docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" < migrations/008_add_password_reset_codes.sql
-- Prod:   same, against the production db container (see server/DEPLOY.md).
--
-- Idempotent: safe to run multiple times.

BEGIN;

CREATE TABLE IF NOT EXISTS password_reset_codes (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash    VARCHAR(64) NOT NULL,
  expires_at   TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  consumed_at  TIMESTAMP WITH TIME ZONE NULL,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_reset_codes_user_id_created_at
  ON password_reset_codes (user_id, created_at);

COMMIT;
