-- Update user_sessions from rebuilt rank-1 character_matches.
-- To dry-run, replace COMMIT with ROLLBACK.
BEGIN;

UPDATE user_sessions us
SET
  character_match = cm.character_id,
  questionnaire_completed = TRUE,
  completed_at = COALESCE(us.completed_at, NOW())
FROM character_matches cm
WHERE cm.user_session_id IN (
    'ad8cf96b-578d-439d-80d7-9f137cc2a251'::uuid,
    '58f9f855-be87-4214-b732-3129ebdbc36e'::uuid
  )
  AND us.id = cm.user_session_id
  AND cm.match_rank = 1;

COMMIT;
