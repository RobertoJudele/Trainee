-- Deletes accounts and everything hanging off them. Replaces delete-demo-data.sql.
--
-- Pick what to purge with -v mode=... :
--
--   demo      the seeded screenshot accounts only (*.demo@salvio.app,
--             *.demo@trainee.app) — the inverse of `npm run seed:demo`
--   trainers  every trainer account
--   all       every non-admin account (trainers and clients)
--
--   psql -v ON_ERROR_STOP=1 -v mode=trainers -f purge-accounts.sql
--
-- Admins are never touched, in any mode — deleting them locks you out of
-- admin-issues. Gyms and specializations are reference data and stay.
--
-- Wrapped in one transaction: if a table is missing from the list below the
-- whole thing rolls back and the error names it. Nothing is half-deleted.
-- Most FKs in this schema declare no ON DELETE rule (only refresh_tokens,
-- user_push_tokens, trainer_blocked_dates and reviews cascade), so children
-- are deleted explicitly, deepest first.
--
-- ALWAYS run the SELECT in the "preview" section of the README command first.
-- This script commits; there is no prompt between the count and the delete.

BEGIN;

CREATE TEMP TABLE doomed_users ON COMMIT DROP AS
  SELECT id FROM users
   WHERE role <> 'admin'
     AND (
          (:'mode' = 'demo'
             AND (email LIKE '%.demo@salvio.app' OR email LIKE '%.demo@trainee.app'))
       OR (:'mode' = 'trainers' AND role = 'trainer')
       OR (:'mode' = 'all')
     );

CREATE TEMP TABLE doomed_trainers ON COMMIT DROP AS
  SELECT id FROM trainer_profiles WHERE user_id IN (SELECT id FROM doomed_users);

CREATE TEMP TABLE doomed_slots ON COMMIT DROP AS
  SELECT id FROM trainer_schedule_slots
  WHERE trainer_id IN (SELECT id FROM doomed_trainers)
     OR client_id  IN (SELECT id FROM doomed_users);

\echo '--- deleting ---'
SELECT (SELECT count(*) FROM doomed_users)    AS users,
       (SELECT count(*) FROM doomed_trainers) AS trainer_profiles,
       (SELECT count(*) FROM doomed_slots)    AS schedule_slots;

-- 1. children of schedule slots
DELETE FROM slot_reminders WHERE slot_id IN (SELECT id FROM doomed_slots);

-- 2. issues reference slots (booking_id), trainers and users — before slots
DELETE FROM issues
 WHERE trainer_id  IN (SELECT id FROM doomed_trainers)
    OR reporter_id IN (SELECT id FROM doomed_users)
    OR resolved_by IN (SELECT id FROM doomed_users)
    OR booking_id  IN (SELECT id FROM doomed_slots);

-- 3. slots (before trainer_working_hours — working_hour_id FK)
DELETE FROM trainer_schedule_slots WHERE id IN (SELECT id FROM doomed_slots);

-- 4. rows keyed on either side of the trainer/client relationship
DELETE FROM reviews
 WHERE trainer_id IN (SELECT id FROM doomed_trainers)
    OR client_id  IN (SELECT id FROM doomed_users);

DELETE FROM client_session_packs
 WHERE trainer_id IN (SELECT id FROM doomed_trainers)
    OR client_id  IN (SELECT id FROM doomed_users);

DELETE FROM trainer_clients
 WHERE trainer_id IN (SELECT id FROM doomed_trainers)
    OR client_id  IN (SELECT id FROM doomed_users);

DELETE FROM client_check_in_codes
 WHERE client_id           IN (SELECT id FROM doomed_users)
    OR consumed_by_user_id IN (SELECT id FROM doomed_users);

DELETE FROM profile_view_events
 WHERE trainer_id     IN (SELECT id FROM doomed_trainers)
    OR viewer_user_id IN (SELECT id FROM doomed_users);

DELETE FROM user_blocks
 WHERE blocker_id IN (SELECT id FROM doomed_users)
    OR blocked_id IN (SELECT id FROM doomed_users);

-- 5. trainer-owned rows
DELETE FROM trainer_working_hours   WHERE trainer_id IN (SELECT id FROM doomed_trainers);
DELETE FROM trainer_blocked_dates   WHERE trainer_id IN (SELECT id FROM doomed_trainers);
DELETE FROM trainer_gyms            WHERE trainer_id IN (SELECT id FROM doomed_trainers);
DELETE FROM trainer_specializations WHERE trainer_id IN (SELECT id FROM doomed_trainers);
DELETE FROM trainer_packages        WHERE trainer_id IN (SELECT id FROM doomed_trainers);
DELETE FROM trainer_images          WHERE trainer_id IN (SELECT id FROM doomed_trainers);
DELETE FROM trainer_invite_codes    WHERE trainer_id IN (SELECT id FROM doomed_trainers);
DELETE FROM billing_transactions    WHERE trainer_id IN (SELECT id FROM doomed_trainers);

-- 6. user-owned rows
DELETE FROM client_preferences WHERE user_id IN (SELECT id FROM doomed_users);
DELETE FROM refresh_tokens     WHERE user_id IN (SELECT id FROM doomed_users);
DELETE FROM user_push_tokens   WHERE user_id IN (SELECT id FROM doomed_users);

-- 7. the accounts themselves
DELETE FROM trainer_profiles WHERE id IN (SELECT id FROM doomed_trainers);
DELETE FROM users            WHERE id IN (SELECT id FROM doomed_users);

COMMIT;
