-- =============================================================================
-- Backfill: aggregate question_responses + track contributing sessions
-- =============================================================================
-- Purpose:
-- 1) Add user_session_ids UUID[] for aggregate rows.
-- 2) Merge duplicate aggregate rows into one row per answer option.
-- 3) Sum count and preserve contributing sessions in user_session_ids.
--
-- Aggregate scope:
-- - is_text_response = FALSE
-- - question_type in ('scale-question', 'multiple-choice', 'multi-select', 'searchable-dropdown')
--
-- If you later DROP COLUMN question_responses.user_session_id, ensure no view
-- (e.g. text_responses) still references that column — see migrate_question_responses_drop_user_session_id.sql.
-- =============================================================================

BEGIN;

ALTER TABLE question_responses
ADD COLUMN IF NOT EXISTS user_session_ids UUID[] NOT NULL DEFAULT '{}';

CREATE TEMP TABLE _chon_qr_aggregate_merge AS
WITH grouped AS (
  SELECT
    qr.questionnaire_type,
    qr.question_id,
    qr.original_question_id,
    qr.question_type,
    qr.response_value,
    MIN(qr.id) AS keep_id,
    SUM(COALESCE(qr.count, 1))::int AS total_count,
    COALESCE(
      (
        SELECT ARRAY_AGG(DISTINCT t.y)
        FROM (
          SELECT unnest(COALESCE(q2.user_session_ids, '{}'::uuid[])) AS y
          FROM question_responses q2
          WHERE q2.questionnaire_type = qr.questionnaire_type
            AND q2.question_id = qr.question_id
            AND q2.original_question_id = qr.original_question_id
            AND q2.question_type = qr.question_type
            AND COALESCE(q2.response_value, '') = COALESCE(qr.response_value, '')
            AND COALESCE(q2.is_text_response, FALSE) IS FALSE
            AND q2.question_type IN ('scale-question', 'multiple-choice', 'multi-select', 'searchable-dropdown')
          UNION ALL
          SELECT q2.user_session_id AS y
          FROM question_responses q2
          WHERE q2.user_session_id IS NOT NULL
            AND q2.questionnaire_type = qr.questionnaire_type
            AND q2.question_id = qr.question_id
            AND q2.original_question_id = qr.original_question_id
            AND q2.question_type = qr.question_type
            AND COALESCE(q2.response_value, '') = COALESCE(qr.response_value, '')
            AND COALESCE(q2.is_text_response, FALSE) IS FALSE
            AND q2.question_type IN ('scale-question', 'multiple-choice', 'multi-select', 'searchable-dropdown')
        ) t
        WHERE t.y IS NOT NULL
      ),
      '{}'::uuid[]
    ) AS all_session_ids
  FROM question_responses qr
  WHERE COALESCE(qr.is_text_response, FALSE) IS FALSE
    AND qr.question_type IN ('scale-question', 'multiple-choice', 'multi-select', 'searchable-dropdown')
  GROUP BY qr.questionnaire_type, qr.question_id, qr.original_question_id, qr.question_type, qr.response_value
)
SELECT * FROM grouped;

UPDATE question_responses qr
SET
  count = m.total_count,
  user_session_ids = COALESCE(m.all_session_ids, '{}')
FROM _chon_qr_aggregate_merge m
WHERE qr.id = m.keep_id;

DELETE FROM question_responses qr
USING _chon_qr_aggregate_merge m
WHERE qr.questionnaire_type = m.questionnaire_type
  AND qr.question_id = m.question_id
  AND qr.original_question_id = m.original_question_id
  AND qr.question_type = m.question_type
  AND COALESCE(qr.response_value, '') = COALESCE(m.response_value, '')
  AND qr.id <> m.keep_id
  AND COALESCE(qr.is_text_response, FALSE) IS FALSE
  AND qr.question_type IN ('scale-question', 'multiple-choice', 'multi-select', 'searchable-dropdown');

CREATE UNIQUE INDEX IF NOT EXISTS uq_question_responses_aggregate_answer
ON question_responses (questionnaire_type, question_id, original_question_id, question_type, response_value)
WHERE COALESCE(is_text_response, FALSE) IS FALSE
  AND question_type IN ('scale-question', 'multiple-choice', 'multi-select', 'searchable-dropdown');

COMMIT;
