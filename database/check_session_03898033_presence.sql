-- =============================================================================
-- Diagnostic: session present in tag_statistics but absent elsewhere
-- =============================================================================
--
-- Target session:
--   03898033-e7af-429f-ad8f-51a5b8b5a737
--
-- This is read-only.
-- =============================================================================

-- 1) Row counts by table.
SELECT
  'user_sessions' AS table_name,
  COUNT(*) AS row_count
FROM user_sessions
WHERE id = '03898033-e7af-429f-ad8f-51a5b8b5a737'::uuid

UNION ALL

SELECT
  'question_responses' AS table_name,
  COUNT(*) AS row_count
FROM question_responses
WHERE user_session_ids @> ARRAY['03898033-e7af-429f-ad8f-51a5b8b5a737'::uuid]

UNION ALL

SELECT
  'tag_scores' AS table_name,
  COUNT(*) AS row_count
FROM tag_scores
WHERE user_session_id = '03898033-e7af-429f-ad8f-51a5b8b5a737'::uuid

UNION ALL

SELECT
  'tag_statistics' AS table_name,
  COUNT(*) AS row_count
FROM tag_statistics
WHERE user_session_id = '03898033-e7af-429f-ad8f-51a5b8b5a737'::uuid

UNION ALL

SELECT
  'character_matches' AS table_name,
  COUNT(*) AS row_count
FROM character_matches
WHERE user_session_id = '03898033-e7af-429f-ad8f-51a5b8b5a737'::uuid
ORDER BY table_name;

-- 2) Existing user session row, if any.
SELECT
  id,
  questionnaire_type,
  questionnaire_completed,
  character_match,
  email_verified,
  created_at,
  completed_at
FROM user_sessions
WHERE id = '03898033-e7af-429f-ad8f-51a5b8b5a737'::uuid;

-- 3) Existing tag_statistics rows.
SELECT
  tag_english,
  user_score,
  total_possible_score,
  score_percentage,
  answered_questions,
  question_25_bonus_applied,
  question_25_bonus_tag,
  created_at
FROM tag_statistics
WHERE user_session_id = '03898033-e7af-429f-ad8f-51a5b8b5a737'::uuid
ORDER BY tag_english;

-- 4) Existing tag_scores rows, if any. If present, character_matches can be
-- rebuilt from tag_statistics/tag_scores, but Q25 cannot be recovered from
-- question_responses if no question_responses rows exist.
SELECT
  tag_english,
  unified_question_id,
  score,
  created_at
FROM tag_scores
WHERE user_session_id = '03898033-e7af-429f-ad8f-51a5b8b5a737'::uuid
ORDER BY tag_english, unified_question_id;

-- 5) Any Q25 marker already denormalized into tag_statistics.
SELECT
  CASE question_25_bonus_tag
    WHEN 'dedication' THEN 'A'
    WHEN 'emotionalRegulation' THEN 'B'
    WHEN 'selfAwareness' THEN 'C'
    WHEN 'socialIntelligence' THEN 'D'
    WHEN 'coreEndurance' THEN 'E'
    WHEN 'objectivity' THEN 'F'
    ELSE NULL
  END AS inferred_q25_answer,
  question_25_bonus_tag
FROM tag_statistics
WHERE user_session_id = '03898033-e7af-429f-ad8f-51a5b8b5a737'::uuid
  AND COALESCE(question_25_bonus_applied, FALSE)
ORDER BY created_at DESC
LIMIT 1;
