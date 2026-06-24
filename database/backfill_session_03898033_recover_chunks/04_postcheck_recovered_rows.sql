-- Check that reconstructed tag_scores match tag_statistics totals.
WITH score_totals AS (
  SELECT
    user_session_id,
    tag_english,
    SUM(score)::int AS recovered_user_score,
    COUNT(*)::int AS recovered_answered_questions
  FROM tag_scores
  WHERE user_session_id = '03898033-e7af-429f-ad8f-51a5b8b5a737'::uuid
  GROUP BY user_session_id, tag_english
)
SELECT
  ts.tag_english,
  ts.user_score AS tag_statistics_user_score,
  st.recovered_user_score,
  ts.answered_questions AS tag_statistics_answered_questions,
  st.recovered_answered_questions,
  (ts.user_score = st.recovered_user_score) AS user_score_matches,
  (ts.answered_questions = st.recovered_answered_questions) AS answered_questions_match
FROM tag_statistics ts
LEFT JOIN score_totals st
  ON st.user_session_id = ts.user_session_id
 AND st.tag_english = ts.tag_english
WHERE ts.user_session_id = '03898033-e7af-429f-ad8f-51a5b8b5a737'::uuid
ORDER BY ts.tag_english;

SELECT
  COUNT(*) AS question_responses_for_session
FROM question_responses
WHERE user_session_ids @> ARRAY['03898033-e7af-429f-ad8f-51a5b8b5a737'::uuid];

SELECT
  questionnaire_type,
  question_id,
  original_question_id,
  question_type,
  response_value,
  score
FROM question_responses
WHERE user_session_ids @> ARRAY['03898033-e7af-429f-ad8f-51a5b8b5a737'::uuid]
ORDER BY original_question_id, question_id;
