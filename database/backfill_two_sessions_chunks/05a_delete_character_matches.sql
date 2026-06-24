-- Delete existing character_matches for the two target sessions.
-- To dry-run, replace COMMIT with ROLLBACK.
BEGIN;

WITH target_sessions(user_session_id) AS (
  SELECT *
  FROM (VALUES
    ('ad8cf96b-578d-439d-80d7-9f137cc2a251'::uuid),
    ('58f9f855-be87-4214-b732-3129ebdbc36e'::uuid)
  ) v(user_session_id)
)
DELETE FROM character_matches cm
USING target_sessions t
WHERE cm.user_session_id = t.user_session_id;

COMMIT;

