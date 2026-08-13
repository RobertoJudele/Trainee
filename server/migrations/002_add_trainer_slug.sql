-- Adds the `slug` column to trainer_profiles, for the public web page at /t/<slug>.
--
-- Why a manual SQL file: the app boots with sequelize.sync({ alter: false }), so a
-- new model column is NOT applied to an existing table automatically. Run this once
-- per environment.
--
-- Local:  docker compose exec db psql -U "$DB_USER" -d "$DB_NAME" -f /migrations/002_add_trainer_slug.sql
--   (or: docker exec -i trainee_db psql -U admin -d trainee < migrations/002_add_trainer_slug.sql)
-- Prod:   same, against the production db container (see server/DEPLOY.md).
--
-- Idempotent: safe to run multiple times.

ALTER TABLE trainer_profiles
  ADD COLUMN IF NOT EXISTS slug VARCHAR(60);

-- Backfill existing trainers from their user's name, mirroring src/utils/slug.ts:
-- unaccent folds ă/â/î and both spellings of ș/ț (comma-below U+0219/U+021B and the
-- cedilla lookalikes U+015F/U+0163 that Windows keyboards emit), then everything
-- outside [a-z0-9] collapses to single hyphens.
--
-- row_number() breaks ties so two trainers called Andrei Popescu become
-- andrei-popescu and andrei-popescu-2, matching makeUniqueSlug's scheme. Ordering by
-- t.id makes the assignment deterministic: the older profile keeps the clean slug.
WITH candidate AS (
  SELECT
    t.id,
    NULLIF(
      trim(BOTH '-' FROM
        regexp_replace(
          lower(unaccent(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, ''))),
          '[^a-z0-9]+', '-', 'g'
        )
      ),
      ''
    ) AS base
  FROM trainer_profiles t
  JOIN users u ON u.id = t.user_id
  WHERE t.slug IS NULL
),
numbered AS (
  SELECT
    id,
    -- No usable name (non-Latin script, emoji only) falls back the same way
    -- trainerSlugBase does.
    coalesce(base, 'antrenor-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)) AS base,
    row_number() OVER (PARTITION BY base ORDER BY id) AS position
  FROM candidate
)
UPDATE trainer_profiles t
SET slug = left(
  CASE WHEN n.position = 1 THEN n.base ELSE n.base || '-' || n.position END,
  60
)
FROM numbered n
WHERE t.id = n.id;

-- Unique only among non-null values, so trainers created before this ran (should be
-- none after the backfill) do not block each other.
CREATE UNIQUE INDEX IF NOT EXISTS trainer_profiles_slug_key
  ON trainer_profiles (slug)
  WHERE slug IS NOT NULL;
