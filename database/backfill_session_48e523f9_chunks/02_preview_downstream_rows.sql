-- Preview current tag_statistics rows for the target session.
WITH target_sessions(user_session_id) AS (
  SELECT *
  FROM (VALUES
    ('48e523f9-ded7-4f58-a1e9-46a9164c1eef'::uuid)
  ) v(user_session_id)
)
SELECT
  t.user_session_id,
  ts.tag_english,
  ts.user_score,
  ts.total_possible_score,
  ts.score_percentage,
  ts.answered_questions,
  ts.question_25_bonus_applied,
  ts.question_25_bonus_tag
FROM target_sessions t
LEFT JOIN tag_statistics ts
  ON ts.user_session_id = t.user_session_id
ORDER BY
  t.user_session_id,
  ts.tag_english;

