-- =============================================================================
-- Migrate question_responses: drop user_session_id, use user_session_ids only
-- =============================================================================
-- Run AFTER backfill_question_responses_aggregate_sessions.sql (or equivalent)
-- that merged per-session rows, OR run section 1 here first if column exists.
--
-- IMPORTANT: Any VIEW (or rule) that SELECTs question_responses.user_session_id
-- must be dropped BEFORE DROP COLUMN, or PostgreSQL raises 2BP01. This script
-- drops public.text_responses first, then recreates it after the column is gone.
-- If you add other views on question_responses, drop them here too or use
-- pg_depend to list dependents before migrating.
-- =============================================================================

BEGIN;

-- 1) Ensure session UUID is listed in user_session_ids before dropping column
UPDATE question_responses
SET user_session_ids = ARRAY_APPEND(
  COALESCE(user_session_ids, '{}'::uuid[]),
  user_session_id
)
WHERE user_session_id IS NOT NULL
  AND NOT (COALESCE(user_session_ids, '{}'::uuid[]) @> ARRAY[user_session_id]);

-- 2) Drop dependent partial unique index if it references user_session_id
DROP INDEX IF EXISTS uq_question_responses_aggregate_answer;

-- 2a) Drop views that reference question_responses.user_session_id (required before DROP COLUMN)
DROP VIEW IF EXISTS public.text_responses;

-- 3) Drop FK and column (adjust constraint name if your DB differs)
ALTER TABLE question_responses DROP CONSTRAINT IF EXISTS question_responses_user_session_id_fkey;
ALTER TABLE question_responses DROP COLUMN IF EXISTS user_session_id;

-- 4) Recreate unique index for aggregate (non-text) rows — no user_session_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_question_responses_aggregate_answer
ON question_responses (questionnaire_type, question_id, original_question_id, question_type, response_value)
WHERE COALESCE(is_text_response, FALSE) IS FALSE
  AND question_type IN ('scale-question', 'multiple-choice', 'multi-select', 'searchable-dropdown');

-- 5) Recreate text_responses (compat: exposes first session UUID as user_session_id)
CREATE OR REPLACE VIEW public.text_responses AS
SELECT
  id,
  questionnaire_type,
  question_id,
  original_question_id,
  response_text,
  CASE WHEN cardinality(user_session_ids) >= 1 THEN user_session_ids[1] ELSE NULL END AS user_session_id,
  created_at,
  updated_at
FROM question_responses
WHERE is_text_response = TRUE;

COMMIT;
