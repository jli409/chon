-- Preview Q25-shaped rows for the target session.
WITH target_sessions(user_session_id) AS (
  SELECT *
  FROM (VALUES
    ('48e523f9-ded7-4f58-a1e9-46a9164c1eef'::uuid)
  ) v(user_session_id)
)
SELECT
  t.user_session_id,
  qr.id,
  qr.questionnaire_type,
  qr.question_id,
  qr.original_question_id,
  qr.response_value,
  qr.response_text,
  qr.updated_at,
  qr.created_at
FROM target_sessions t
JOIN question_responses qr
  ON qr.user_session_ids @> ARRAY[t.user_session_id]::uuid[]
WHERE qr.question_type = 'multiple-choice'
  AND NOT COALESCE(qr.is_text_response, FALSE)
  AND (
    qr.original_question_id IN (25, 29, 33, 45)
    OR qr.question_id::text IN (
      'mother_33',
      'corporate_33',
      'other_29',
      'both_45',
      'mother_unified_25',
      'corporate_unified_25',
      'other_unified_25',
      'both_unified_25'
    )
  )
ORDER BY
  t.user_session_id,
  qr.updated_at DESC NULLS LAST,
  qr.created_at DESC NULLS LAST,
  qr.id DESC;

