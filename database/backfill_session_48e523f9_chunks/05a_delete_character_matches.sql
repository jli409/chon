-- Delete existing character_matches for the target session.
-- To dry-run, replace COMMIT with ROLLBACK.
BEGIN;

WITH target_sessions(user_session_id) AS (
  SELECT *
  FROM (VALUES
    ('48e523f9-ded7-4f58-a1e9-46a9164c1eef'::uuid)
  ) v(user_session_id)
)
DELETE FROM character_matches cm
USING target_sessions t
WHERE cm.user_session_id = t.user_session_id;

COMMIT;

