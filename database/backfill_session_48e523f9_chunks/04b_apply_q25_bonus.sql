-- Re-resolve Q25 from question_responses and apply the +10 bonus.
-- Run 04a_reset_tag_statistics_baseline.sql before this file.
-- To dry-run, replace COMMIT with ROLLBACK.
BEGIN;

WITH
target_sessions(user_session_id) AS (
  SELECT *
  FROM (VALUES
    ('48e523f9-ded7-4f58-a1e9-46a9164c1eef'::uuid)
  ) v(user_session_id)
),
q25_candidates AS (
  SELECT
    t.user_session_id,
    UPPER(
      SUBSTRING(
        TRIM(
          COALESCE(
            NULLIF(TRIM(COALESCE(qr.response_value, '')), ''),
            NULLIF(TRIM(COALESCE(qr.response_text, '')), '')
          )
        ),
        1,
        1
      )
    ) AS q25,
    qr.updated_at,
    qr.created_at,
    qr.id,
    CASE
      WHEN us.questionnaire_type IS NOT NULL
       AND qr.questionnaire_type = us.questionnaire_type THEN 0
      ELSE 1
    END AS questionnaire_rank
  FROM target_sessions t
  INNER JOIN question_responses qr
    ON qr.user_session_ids @> ARRAY[t.user_session_id]::uuid[]
  LEFT JOIN user_sessions us
    ON us.id = t.user_session_id
  WHERE qr.question_type = 'multiple-choice'
    AND NOT COALESCE(qr.is_text_response, FALSE)
    AND (
      qr.original_question_id = 25
      OR btrim(qr.original_question_id::text) = '25'
      OR qr.question_id::text = '25'
      OR qr.question_id::text ~ '_25$'
      OR qr.question_id::text ~* '_unified_25$'
      OR lower(btrim(qr.question_id::text)) IN (
        'mother_33',
        'corporate_33',
        'other_29',
        'both_45'
      )
      OR (qr.questionnaire_type = 'mother' AND qr.original_question_id = 33)
      OR (qr.questionnaire_type = 'corporate' AND qr.original_question_id = 33)
      OR (qr.questionnaire_type = 'other' AND qr.original_question_id = 29)
      OR (qr.questionnaire_type = 'both' AND qr.original_question_id = 45)
    )
),
q25_latest AS (
  SELECT DISTINCT ON (user_session_id)
    user_session_id,
    q25
  FROM q25_candidates
  WHERE q25 IN ('A', 'B', 'C', 'D', 'E', 'F')
  ORDER BY
    user_session_id,
    questionnaire_rank ASC,
    updated_at DESC NULLS LAST,
    created_at DESC NULLS LAST,
    id DESC
),
resolved AS (
  SELECT
    user_session_id,
    q25,
    CASE q25
      WHEN 'A' THEN 'dedication'
      WHEN 'B' THEN 'emotionalRegulation'
      WHEN 'C' THEN 'selfAwareness'
      WHEN 'D' THEN 'socialIntelligence'
      WHEN 'E' THEN 'coreEndurance'
      WHEN 'F' THEN 'objectivity'
    END AS bonus_tag
  FROM q25_latest
)
UPDATE tag_statistics ts
SET
  question_25_bonus_applied = TRUE,
  question_25_bonus_tag = r.bonus_tag,
  score_percentage = LEAST(100, ts.score_percentage + 10),
  user_score = CASE
    WHEN ts.total_possible_score > 0
    THEN ROUND((LEAST(100, ts.score_percentage + 10)::numeric / 100.0) * ts.total_possible_score)::int
    ELSE ts.user_score
  END
FROM resolved r
WHERE ts.user_session_id = r.user_session_id
  AND ts.tag_english = r.bonus_tag;

COMMIT;
