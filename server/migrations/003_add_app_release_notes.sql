-- "What's new" text shown once after a user updates the app.
--
-- Why a manual SQL file: the app boots with sequelize.sync({ alter: false }), so a
-- new model is NOT created automatically on an existing database. Run this once
-- per environment.
--
-- Local:  docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" < migrations/003_add_app_release_notes.sql
-- Prod:   same, against the production db container (see server/DEPLOY.md).
--
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS app_release_notes (
  version      VARCHAR(20)  PRIMARY KEY,
  title        VARCHAR(120) NOT NULL,
  body         TEXT         NOT NULL,
  -- Draft rows stay invisible, so notes can be written before the build is live.
  is_published BOOLEAN      NOT NULL DEFAULT false,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- One row per version, shared by both platforms: the text describes the release,
-- not the store it came from.
--
-- To announce a release, after the build is live in BOTH stores:
--
--   INSERT INTO app_release_notes (version, title, body, is_published)
--   VALUES (
--     '1.1.0',
--     'Profil public pentru antrenori',
--     E'Ai acum o pagină web proprie, de pus în bio-ul de Instagram.\nO găsești în meniul din profil, la "Distribuie linkul meu".',
--     true
--   )
--   ON CONFLICT (version) DO UPDATE
--     SET title = EXCLUDED.title,
--         body = EXCLUDED.body,
--         is_published = EXCLUDED.is_published,
--         updated_at = now();
--
-- Nothing is shown for a version with no row, so skipping a release is fine.
