-- Post-run character_matches comparison.
SELECT
  cm.user_session_id,
  cm.match_rank,
  cm.character_id,
  cm.in_range_count,
  cm.out_of_range_diff_sum,
  cm.final_percentage,
  cm.question_25_answer
FROM character_matches cm
WHERE cm.user_session_id IN (
  'ad8cf96b-578d-439d-80d7-9f137cc2a251'::uuid,
  '58f9f855-be87-4214-b732-3129ebdbc36e'::uuid
)
ORDER BY
  cm.user_session_id,
  cm.match_rank;
