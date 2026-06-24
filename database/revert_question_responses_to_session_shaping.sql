-- =============================================================================
-- Revert question_responses aggregate uniqueness to session-shaped writes
-- =============================================================================
-- Goal:
--   Restore previous behavior where writes are shaped per session and are not
--   forced into one cross-session aggregate row by
--   uq_question_responses_aggregate_answer.
--
-- Effect:
--   - Drops aggregate unique index that caused 23505 on concurrent/replay writes.
--   - Keeps table data/columns intact (no destructive data migration).
-- =============================================================================

BEGIN;

DROP INDEX IF EXISTS public.uq_question_responses_aggregate_answer;

COMMIT;
