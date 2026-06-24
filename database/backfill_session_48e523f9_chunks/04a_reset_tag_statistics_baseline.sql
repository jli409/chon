-- Reset tag_statistics to the tag_scores baseline for the target session.
-- This makes the Q25 bonus step safe to rerun.
-- To dry-run, replace COMMIT with ROLLBACK.
BEGIN;

WITH
target_sessions(user_session_id) AS (
  SELECT *
  FROM (VALUES
    ('48e523f9-ded7-4f58-a1e9-46a9164c1eef'::uuid)
  ) v(user_session_id)
),
agg AS (
  SELECT
    sc.user_session_id,
    sc.tag_english,
    SUM(sc.score)::int AS user_score,
    (COUNT(*) * 100)::int AS total_possible_score,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((SUM(sc.score)::numeric / (COUNT(*) * 100)::numeric) * 100)::int
    END AS score_percentage,
    COUNT(*)::int AS answered_questions
  FROM tag_scores sc
  INNER JOIN target_sessions t
    ON t.user_session_id = sc.user_session_id
  GROUP BY
    sc.user_session_id,
    sc.tag_english
),
canon(tag_english) AS (
  SELECT unnest(ARRAY[
    'selfAwareness',
    'dedication',
    'socialIntelligence',
    'emotionalRegulation',
    'objectivity',
    'coreEndurance'
  ]::text[])
),
filled AS (
  SELECT
    t.user_session_id,
    c.tag_english,
    COALESCE(a.user_score, 0) AS user_score,
    COALESCE(a.total_possible_score, 0) AS total_possible_score,
    COALESCE(a.score_percentage, 0)::int AS score_percentage,
    COALESCE(a.answered_questions, 0) AS answered_questions
  FROM target_sessions t
  CROSS JOIN canon c
  LEFT JOIN agg a
    ON a.user_session_id = t.user_session_id
   AND a.tag_english = c.tag_english
)
UPDATE tag_statistics ts
SET
  user_score = f.user_score,
  total_possible_score = f.total_possible_score,
  score_percentage = f.score_percentage,
  answered_questions = f.answered_questions,
  question_25_bonus_applied = FALSE,
  question_25_bonus_tag = NULL
FROM filled f
WHERE ts.user_session_id = f.user_session_id
  AND ts.tag_english = f.tag_english;

COMMIT;

