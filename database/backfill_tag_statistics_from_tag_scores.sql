-- =============================================================================
-- Backfill / repair tag_statistics from tag_scores (Supabase / PostgreSQL)
-- =============================================================================
--
-- Use when tag_statistics has fewer than 6 rows per session but tag_scores has
-- per-question rows you can aggregate.
--
-- -----------------------------------------------------------------------------
-- MANUAL STEPS (edit before running)
-- -----------------------------------------------------------------------------
-- 1) Optional: restrict to one session for testing — uncomment and set UUID:
--      AND ts.user_session_id = 'PASTE-SESSION-UUID-HERE'::uuid
--    in the sessions CTE below (two places: INSERT target + tag_scores filter).
-- 2) Confirm tag_scores.tag_english uses the same 6 values as the app:
--      selfAwareness, dedication, socialIntelligence, emotionalRegulation,
--      objectivity, coreEndurance
-- 3) Run PREVIEW first. Then run BACKFILL in a transaction; prefer ROLLBACK
--    once to verify, then COMMIT.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PREVIEW: sessions with >= 1 tag_scores row but < 6 tag_statistics rows
-- -----------------------------------------------------------------------------
WITH ts_count AS (
  SELECT user_session_id, COUNT(*)::int AS n
  FROM tag_statistics
  GROUP BY user_session_id
),
sc_count AS (
  SELECT user_session_id, COUNT(DISTINCT tag_english)::int AS n
  FROM tag_scores
  GROUP BY user_session_id
)
SELECT
  sc.user_session_id,
  COALESCE(ts.n, 0) AS tag_statistics_rows,
  sc.n AS distinct_tag_english_in_tag_scores
FROM sc_count sc
LEFT JOIN ts_count ts ON ts.user_session_id = sc.user_session_id
WHERE COALESCE(ts.n, 0) < 6
ORDER BY sc.user_session_id;

-- =============================================================================
-- BACKFILL: replace tag_statistics for those sessions using aggregates of tag_scores
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _chon_sessions_fix_ts (
  user_session_id UUID PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO _chon_sessions_fix_ts (user_session_id)
SELECT sc.user_session_id
FROM (
  SELECT user_session_id, COUNT(DISTINCT tag_english)::int AS n
  FROM tag_scores
  GROUP BY user_session_id
  HAVING COUNT(DISTINCT tag_english) >= 6
) sc
LEFT JOIN (
  SELECT user_session_id, COUNT(*)::int AS n
  FROM tag_statistics
  GROUP BY user_session_id
) ts ON ts.user_session_id = sc.user_session_id
WHERE COALESCE(ts.n, 0) < 6;

-- MANUAL: optional single-session test — uncomment:
-- DELETE FROM _chon_sessions_fix_ts;
-- INSERT INTO _chon_sessions_fix_ts VALUES ('PASTE-SESSION-UUID-HERE'::uuid);

DELETE FROM tag_statistics t
USING _chon_sessions_fix_ts s
WHERE t.user_session_id = s.user_session_id;

INSERT INTO tag_statistics (
  user_session_id,
  tag_english,
  user_score,
  total_possible_score,
  score_percentage,
  answered_questions,
  question_25_bonus_applied,
  question_25_bonus_tag
)
SELECT
  agg.user_session_id,
  agg.tag_english,
  agg.user_score,
  agg.total_possible_score,
  LEAST(100, GREATEST(0, agg.score_percentage))::int,
  agg.answered_questions,
  FALSE,
  NULL
FROM (
  SELECT
    user_session_id,
    tag_english,
    SUM(score)::int AS user_score,
    (COUNT(*) * 100)::int AS total_possible_score,
    ROUND(
      (SUM(score)::numeric / NULLIF(COUNT(*) * 100, 0)) * 100
    )::int AS score_percentage,
    COUNT(*)::int AS answered_questions
  FROM tag_scores
  WHERE user_session_id IN (SELECT user_session_id FROM _chon_sessions_fix_ts)
  GROUP BY user_session_id, tag_english
) agg;

-- ROLLBACK;
COMMIT;
