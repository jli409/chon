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
    '48e523f9-ded7-4f58-a1e9-46a9164c1eef'::uuid
  )
  AND us.id = cm.user_session_id
  AND cm.match_rank = 1;

COMMIT;
