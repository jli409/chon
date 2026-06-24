-- Delete prior synthetic recovery rows for this session only.
BEGIN;

DELETE FROM tag_scores
WHERE user_session_id = '03898033-e7af-429f-ad8f-51a5b8b5a737'::uuid
  AND unified_question_id BETWEEN 30000 AND 30699;

DELETE FROM question_responses
WHERE user_session_ids @> ARRAY['03898033-e7af-429f-ad8f-51a5b8b5a737'::uuid]
  AND question_id::text LIKE 'recovered_tag_stat_%'
  AND original_question_id BETWEEN 30000 AND 30699;

COMMIT;

