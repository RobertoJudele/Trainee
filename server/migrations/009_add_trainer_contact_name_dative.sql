-- Trainer's name in the dative for the app's contact button ("lui Andrei",
-- "Elenei"), typed in at onboarding.
--
-- The server also adds this column on boot (ensureSpatialAndSearchInfrastructure,
-- before it starts listening), so this does not have to run before the deploy.
-- It exists so the schema is explicit, like 005-008. Run once per environment.
--
-- Local:  docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" < migrations/009_add_trainer_contact_name_dative.sql
-- Prod:   same, against the production db container (see server/DEPLOY.md).
--
-- Idempotent: safe to run multiple times.

BEGIN;

ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS contact_name_dative VARCHAR(60);

COMMIT;
