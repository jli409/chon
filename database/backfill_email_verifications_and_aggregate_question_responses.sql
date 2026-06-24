-- =============================================================================
-- Backfill / schema update for email_verifications + aggregate question_responses
-- =============================================================================
-- Goals:
-- 1) email_verifications.is_verified is determined by real verify click state
--    (represented by verified_at).
-- 2) email_verifications.questionnaire_type is auto-filled from identity selection
--    stored in user_sessions.questionnaire_type.
-- 3) question_responses aggregate rows are shared across sessions:
--    - one aggregate row per answer choice
--    - count is summed
--    - contributing sessions are tracked in user_session_ids (uuid[]).
--
-- NOTE:
-- - question_responses uses `user_session_ids` only (no user_session_id column after migrate).
-- - Run `migrate_question_responses_drop_user_session_id.sql` after this merge if the old column exists.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0) Add multi-session tracking column for aggregate rows
-- -----------------------------------------------------------------------------
ALTER TABLE question_responses
ADD COLUMN IF NOT EXISTS user_session_ids UUID[] NOT NULL DEFAULT '{}';

-- -----------------------------------------------------------------------------
-- 1) email_verifications: synchronize is_verified <-> verified_at
-- -----------------------------------------------------------------------------
-- If verified_at exists, mark verified.
UPDATE email_verifications
SET is_verified = TRUE
WHERE verified_at IS NOT NULL
  AND COALESCE(is_verified, FALSE) IS NOT TRUE;

-- If marked verified but timestamp is missing, set timestamp.
UPDATE email_verifications
SET verified_at = COALESCE(verified_at, NOW())
WHERE COALESCE(is_verified, FALSE) IS TRUE;

-- If not verified, verified_at should be NULL.
UPDATE email_verifications
SET verified_at = NULL
WHERE COALESCE(is_verified, FALSE) IS NOT TRUE
  AND verified_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2) email_verifications.questionnaire_type from user_sessions identity selection
-- -----------------------------------------------------------------------------
-- Prefer direct session link first.
UPDATE email_verifications ev
SET questionnaire_type = us.questionnaire_type
FROM user_sessions us
WHERE ev.user_session_id = us.id
  AND us.questionnaire_type IN ('mother', 'corporate', 'other', 'both')
  AND (
    ev.questionnaire_type IS NULL
    OR ev.questionnaire_type <> us.questionnaire_type
  );

-- Fallback by latest session with same email.
UPDATE email_verifications ev
SET questionnaire_type = latest.questionnaire_type
FROM (
  SELECT DISTINCT ON (LOWER(TRIM(email)))
    LOWER(TRIM(email)) AS normalized_email,
    questionnaire_type
  FROM user_sessions
  WHERE email IS NOT NULL
    AND TRIM(email) <> ''
    AND questionnaire_type IN ('mother', 'corporate', 'other', 'both')
  ORDER BY LOWER(TRIM(email)), created_at DESC NULLS LAST, id DESC
) latest
WHERE ev.email IS NOT NULL
  AND TRIM(ev.email) <> ''
  AND LOWER(TRIM(ev.email)) = latest.normalized_email
  AND (
    ev.questionnaire_type IS NULL
    OR ev.questionnaire_type <> latest.questionnaire_type
  );

-- -----------------------------------------------------------------------------
-- 3) Collapse aggregate-style duplicate question_responses rows
-- -----------------------------------------------------------------------------
-- Aggregate-style rows are non-text responses for aggregate question types.
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

-- Prevent future duplicates for aggregate rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_question_responses_aggregate_answer
ON question_responses (questionnaire_type, question_id, original_question_id, question_type, response_value)
WHERE COALESCE(is_text_response, FALSE) IS FALSE
  AND question_type IN ('scale-question', 'multiple-choice', 'multi-select', 'searchable-dropdown');

COMMIT;
