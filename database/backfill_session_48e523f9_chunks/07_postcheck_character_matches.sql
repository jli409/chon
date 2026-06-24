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
  '48e523f9-ded7-4f58-a1e9-46a9164c1eef'::uuid
)
ORDER BY
  cm.user_session_id,
  cm.match_rank;
