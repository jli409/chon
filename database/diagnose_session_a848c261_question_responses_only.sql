-- =============================================================================
-- Diagnostic: question_responses-only session
-- =============================================================================
--
-- Target session:
--   a848c261-c13d-4cf1-867e-ba48b0c24ccc
--
-- Purpose:
--   Explain why this UUID appears in question_responses.user_session_ids but not
--   in user_sessions, tag_scores, tag_statistics, or character_matches.
--
-- This script is read-only.
-- =============================================================================

-- 1) Presence by table.
SELECT
  'user_sessions' AS table_name,
  COUNT(*) AS row_count
FROM user_sessions
WHERE id = 'a848c261-c13d-4cf1-867e-ba48b0c24ccc'::uuid

UNION ALL

SELECT
  'question_responses' AS table_name,
  COUNT(*) AS row_count
FROM question_responses
WHERE user_session_ids @> ARRAY['a848c261-c13d-4cf1-867e-ba48b0c24ccc'::uuid]

UNION ALL

SELECT
  'tag_scores' AS table_name,
  COUNT(*) AS row_count
FROM tag_scores
WHERE user_session_id = 'a848c261-c13d-4cf1-867e-ba48b0c24ccc'::uuid

UNION ALL

SELECT
  'tag_statistics' AS table_name,
  COUNT(*) AS row_count
FROM tag_statistics
WHERE user_session_id = 'a848c261-c13d-4cf1-867e-ba48b0c24ccc'::uuid

UNION ALL

SELECT
  'character_matches' AS table_name,
  COUNT(*) AS row_count
FROM character_matches
WHERE user_session_id = 'a848c261-c13d-4cf1-867e-ba48b0c24ccc'::uuid
ORDER BY table_name;

-- 2) Response summary: complete vs partial, flow type, and whether Q25 exists.
WITH qr AS (
  SELECT *
  FROM question_responses
  WHERE user_session_ids @> ARRAY['a848c261-c13d-4cf1-867e-ba48b0c24ccc'::uuid]
),
summary AS (
  SELECT
    COUNT(*)::int AS response_rows,
    COUNT(*) FILTER (WHERE question_type = 'scale-question')::int AS scale_rows,
    COUNT(*) FILTER (WHERE question_type = 'multiple-choice')::int AS multiple_choice_rows,
    COUNT(*) FILTER (WHERE COALESCE(is_text_response, FALSE))::int AS text_rows,
    COUNT(DISTINCT original_question_id)::int AS distinct_original_question_ids,
    MIN(created_at) AS first_response_at,
    MAX(updated_at) AS last_response_updated_at,
    (ARRAY_AGG(questionnaire_type ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC))[1] AS latest_questionnaire_type,
    BOOL_OR(
      question_type = 'multiple-choice'
      AND NOT COALESCE(is_text_response, FALSE)
      AND (
        original_question_id = 25
        OR question_id::text IN ('mother_33', 'corporate_33', 'other_29', 'both_45')
        OR question_id::text ~* '_unified_25$'
      )
    ) AS has_q25_row
  FROM qr
)
SELECT
  *,
  CASE latest_questionnaire_type
    WHEN 'mother' THEN 33
    WHEN 'corporate' THEN 33
    WHEN 'other' THEN 29
    WHEN 'both' THEN 45
    ELSE NULL
  END AS expected_total_questions,
  CASE
    WHEN latest_questionnaire_type IS NULL THEN 'unknown_questionnaire_type'
    WHEN distinct_original_question_ids >= CASE latest_questionnaire_type
      WHEN 'mother' THEN 33
      WHEN 'corporate' THEN 33
      WHEN 'other' THEN 29
      WHEN 'both' THEN 45
    END THEN 'looks_complete_or_nearly_complete'
    ELSE 'partial_or_interrupted_before_completion'
  END AS inferred_response_state
FROM summary;

-- 3) Which rows exist, ordered as the app would have saved them.
SELECT
  id,
  questionnaire_type,
  question_id,
  original_question_id,
  question_type,
  response_value,
  response_text,
  is_text_response,
  score,
  count,
  created_at,
  updated_at
FROM question_responses
WHERE user_session_ids @> ARRAY['a848c261-c13d-4cf1-867e-ba48b0c24ccc'::uuid]
ORDER BY
  created_at NULLS LAST,
  updated_at NULLS LAST,
  original_question_id,
  id;

-- 4) Scale rows that are eligible to become tag_scores.
SELECT
  qr.id,
  qr.questionnaire_type,
  qr.question_id,
  qr.original_question_id,
  qr.response_value,
  qr.score,
  CASE
    WHEN qr.score IS NOT NULL AND qr.score BETWEEN 0 AND 100 THEN qr.score
    WHEN TRIM(COALESCE(qr.response_value, '')) ~ '^[1-5]$' THEN TRIM(qr.response_value)::int * 20
    WHEN UPPER(TRIM(COALESCE(qr.response_value, ''))) = 'A' THEN 20
    WHEN UPPER(TRIM(COALESCE(qr.response_value, ''))) = 'B' THEN 40
    WHEN UPPER(TRIM(COALESCE(qr.response_value, ''))) = 'C' THEN 60
    WHEN UPPER(TRIM(COALESCE(qr.response_value, ''))) = 'D' THEN 80
    WHEN UPPER(TRIM(COALESCE(qr.response_value, ''))) = 'E' THEN 100
    ELSE NULL
  END AS derived_score
FROM question_responses qr
WHERE qr.user_session_ids @> ARRAY['a848c261-c13d-4cf1-867e-ba48b0c24ccc'::uuid]
  AND qr.question_type = 'scale-question'
  AND NOT COALESCE(qr.is_text_response, FALSE)
ORDER BY qr.original_question_id, qr.updated_at DESC NULLS LAST, qr.created_at DESC NULLS LAST, qr.id DESC;

-- 5) Duplicate/conflicting answers by original question.
WITH latestish AS (
  SELECT
    original_question_id,
    question_type,
    COUNT(*) AS row_count,
    COUNT(DISTINCT COALESCE(response_value, response_text, '')) AS distinct_answer_count,
    STRING_AGG(DISTINCT COALESCE(response_value, response_text, ''), ', ' ORDER BY COALESCE(response_value, response_text, '')) AS answers
  FROM question_responses
  WHERE user_session_ids @> ARRAY['a848c261-c13d-4cf1-867e-ba48b0c24ccc'::uuid]
  GROUP BY original_question_id, question_type
)
SELECT *
FROM latestish
WHERE row_count > 1 OR distinct_answer_count > 1
ORDER BY original_question_id, question_type;

-- 6) Likely explanation.
SELECT
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM user_sessions
      WHERE id = 'a848c261-c13d-4cf1-867e-ba48b0c24ccc'::uuid
    )
    AND EXISTS (
      SELECT 1 FROM question_responses
      WHERE user_session_ids @> ARRAY['a848c261-c13d-4cf1-867e-ba48b0c24ccc'::uuid]
    )
    THEN 'question_responses were saved with this UUID in user_session_ids, but no parent user_sessions row exists. Downstream tag_scores/tag_statistics/character_matches are normally written after scoring/completion and require user_session_id as a FK, so they never appeared.'
    ELSE 'not_question_responses_only_shape'
  END AS likely_cause;
