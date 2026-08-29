-- Removes every account created by src/seeds/demoScreenshotSeed.ts
-- (5 trainer profiles + 3 client accounts) and everything hanging off them.
--
-- Anchored on the email pattern the seed writes: *.demo@salvio.app
--
--   psql "$DATABASE_URL" -f delete-demo-data.sql
--
-- Wrapped in a transaction: if any table is missing from the list below, the
-- whole thing rolls back and the error names the table that blocked it.
-- Nothing is half-deleted.
--
-- Most FKs in this schema have no ON DELETE rule (only refresh_tokens,
-- user_push_tokens, trainer_blocked_dates and reviews cascade), so the children
-- are deleted explicitly, deepest first.

BEGIN;

CREATE TEMP TABLE demo_users ON COMMIT DROP AS
  SELECT id FROM users WHERE email LIKE '%.demo@salvio.app';

CREATE TEMP TABLE demo_trainers ON COMMIT DROP AS
  SELECT id FROM trainer_profiles WHERE user_id IN (SELECT id FROM demo_users);

CREATE TEMP TABLE demo_slots ON COMMIT DROP AS
  SELECT id FROM trainer_schedule_slots
  WHERE trainer_id IN (SELECT id FROM demo_trainers)
     OR client_id  IN (SELECT id FROM demo_users);

\echo '--- about to delete ---'
SELECT (SELECT count(*) FROM demo_users)    AS users,
       (SELECT count(*) FROM demo_trainers) AS trainer_profiles,
       (SELECT count(*) FROM demo_slots)    AS schedule_slots;

-- 1. children of schedule slots
DELETE FROM slot_reminders WHERE slot_id IN (SELECT id FROM demo_slots);

-- 2. issues reference slots (booking_id), trainers and users — before slots
DELETE FROM issues
 WHERE trainer_id  IN (SELECT id FROM demo_trainers)
    OR reporter_id IN (SELECT id FROM demo_users)
    OR resolved_by IN (SELECT id FROM demo_users)
    OR booking_id  IN (SELECT id FROM demo_slots);

-- 3. slots (must go before trainer_working_hours — working_hour_id FK)
DELETE FROM trainer_schedule_slots WHERE id IN (SELECT id FROM demo_slots);

-- 4. everything keyed on both sides of the trainer/client relationship
DELETE FROM reviews
 WHERE trainer_id IN (SELECT id FROM demo_trainers)
    OR client_id  IN (SELECT id FROM demo_users);

DELETE FROM client_session_packs
 WHERE trainer_id IN (SELECT id FROM demo_trainers)
    OR client_id  IN (SELECT id FROM demo_users);

DELETE FROM trainer_clients
 WHERE trainer_id IN (SELECT id FROM demo_trainers)
    OR client_id  IN (SELECT id FROM demo_users);

DELETE FROM client_check_in_codes
 WHERE client_id           IN (SELECT id FROM demo_users)
    OR consumed_by_user_id IN (SELECT id FROM demo_users);

DELETE FROM profile_view_events
 WHERE trainer_id     IN (SELECT id FROM demo_trainers)
    OR viewer_user_id IN (SELECT id FROM demo_users);

DELETE FROM user_blocks
 WHERE blocker_id IN (SELECT id FROM demo_users)
    OR blocked_id IN (SELECT id FROM demo_users);

-- 5. trainer-owned rows
DELETE FROM trainer_working_hours   WHERE trainer_id IN (SELECT id FROM demo_trainers);
DELETE FROM trainer_blocked_dates   WHERE trainer_id IN (SELECT id FROM demo_trainers);
DELETE FROM trainer_gyms            WHERE trainer_id IN (SELECT id FROM demo_trainers);
DELETE FROM trainer_specializations WHERE trainer_id IN (SELECT id FROM demo_trainers);
DELETE FROM trainer_packages        WHERE trainer_id IN (SELECT id FROM demo_trainers);
DELETE FROM trainer_images          WHERE trainer_id IN (SELECT id FROM demo_trainers);
DELETE FROM trainer_invite_codes    WHERE trainer_id IN (SELECT id FROM demo_trainers);
DELETE FROM billing_transactions    WHERE trainer_id IN (SELECT id FROM demo_trainers);

-- 6. user-owned rows
DELETE FROM client_preferences WHERE user_id IN (SELECT id FROM demo_users);
DELETE FROM refresh_tokens     WHERE user_id IN (SELECT id FROM demo_users);
DELETE FROM user_push_tokens   WHERE user_id IN (SELECT id FROM demo_users);

-- 7. the accounts themselves
DELETE FROM trainer_profiles WHERE id IN (SELECT id FROM demo_trainers);
DELETE FROM users            WHERE id IN (SELECT id FROM demo_users);

COMMIT;
