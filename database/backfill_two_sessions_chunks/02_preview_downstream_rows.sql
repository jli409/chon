-- Preview current tag_statistics rows for the two target sessions.
WITH target_sessions(user_session_id) AS (
  SELECT *
  FROM (VALUES
    ('ad8cf96b-578d-439d-80d7-9f137cc2a251'::uuid),
    ('58f9f855-be87-4214-b732-3129ebdbc36e'::uuid)
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

