-- Rebuild tag_statistics from existing tag_scores for only the target session.
-- To dry-run, replace COMMIT with ROLLBACK.
BEGIN;

WITH target_sessions(user_session_id) AS (
  SELECT *
  FROM (VALUES
    ('48e523f9-ded7-4f58-a1e9-46a9164c1eef'::uuid)
  ) v(user_session_id)
)
DELETE FROM tag_statistics ts
USING target_sessions t
WHERE ts.user_session_id = t.user_session_id;

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
  user_session_id,
  tag_english,
  user_score,
  total_possible_score,
  score_percentage,
  answered_questions,
  FALSE,
  NULL
FROM filled;

COMMIT;

