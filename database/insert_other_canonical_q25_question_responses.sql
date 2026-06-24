-- =============================================================================
-- Insert canonical Q25 row for questionnaire_type = 'other' only
-- =============================================================================
-- Target row: question_id = 'other_29', original_question_id = 25,
--             question_type = 'multiple-choice', is_text_response = FALSE.
--
-- Does NOT update character_matches or tag_statistics (read-only use for letter).
--
-- Note: For `other`, the final-slot question_id is other_29 (not other_33).
--
-- Preview (run first, same connection):
--   Wrap the INSERT below as: BEGIN; ... INSERT ...; ROLLBACK;
-- =============================================================================

INSERT INTO question_responses (
  questionnaire_type,
  question_id,
  original_question_id,
  question_type,
  response_value,
  response_text,
  is_text_response,
  user_session_ids
)
SELECT
  'other'::varchar(20),
  'other_29'::varchar(50),
  25,
  'multiple-choice'::varchar(20),
  COALESCE(cm_ch.ch, ts_ch.ch, qr_ch.ch, qr_final.ch, u25.ch),
  COALESCE(cm_ch.ch, ts_ch.ch, qr_ch.ch, qr_final.ch, u25.ch),
  FALSE,
  ARRAY[us.id]::uuid[]
FROM user_sessions us
LEFT JOIN LATERAL (
  SELECT UPPER(SUBSTRING(TRIM(cm.question_25_answer), 1, 1)) AS ch
  FROM character_matches cm
  WHERE cm.user_session_id = us.id
    AND cm.question_25_answer IS NOT NULL
    AND btrim(cm.question_25_answer) <> ''
  ORDER BY cm.match_rank ASC NULLS LAST
  LIMIT 1
) cm_ch ON TRUE
LEFT JOIN LATERAL (
  SELECT derived.ch
  FROM (
    SELECT
      ts.id,
      ts.question_25_bonus_applied,
      ts.created_at,
      CASE COALESCE(
        NULLIF(btrim(ts.question_25_bonus_tag::text), ''),
        NULLIF(btrim(ts.tag_english::text), '')
      )
        WHEN 'dedication' THEN 'A'
        WHEN 'emotionalRegulation' THEN 'B'
        WHEN 'selfAwareness' THEN 'C'
        WHEN 'socialIntelligence' THEN 'D'
        WHEN 'coreEndurance' THEN 'E'
        WHEN 'objectivity' THEN 'F'
        ELSE NULL
      END AS ch
    FROM tag_statistics ts
    WHERE ts.user_session_id = us.id
      AND (
        COALESCE(ts.question_25_bonus_applied, FALSE)
        OR (
          ts.question_25_bonus_tag IS NOT NULL
          AND btrim(ts.question_25_bonus_tag::text) <> ''
        )
      )
  ) derived
  WHERE derived.ch IS NOT NULL
  ORDER BY COALESCE(derived.question_25_bonus_applied, FALSE) DESC,
    derived.created_at DESC NULLS LAST,
    derived.id DESC
  LIMIT 1
) ts_ch ON TRUE
LEFT JOIN LATERAL (
  SELECT UPPER(
    SUBSTRING(
      TRIM(COALESCE(qr.response_text, qr.response_value, '')),
      1,
      1
    )
  ) AS ch
  FROM question_responses qr
  WHERE us.id = ANY (COALESCE(qr.user_session_ids, '{}'::uuid[]))
    AND qr.question_type = 'multiple-choice'
    AND NOT COALESCE(qr.is_text_response, FALSE)
    AND (
      qr.questionnaire_type IS NULL
      OR qr.questionnaire_type = 'other'
      OR lower(split_part(qr.question_id::text, '_', 1)) = 'other'
    )
    AND (
      qr.original_question_id = 25
      OR btrim(qr.original_question_id::text) = '25'
      OR qr.question_id::text = '25'
      OR qr.question_id::text ~ '_25$'
      OR (
        SUBSTRING(qr.question_id::text FROM '([0-9]+)$') IS NOT NULL
        AND (SUBSTRING(qr.question_id::text FROM '([0-9]+)$'))::int = 25
      )
      OR lower(btrim(qr.question_id::text)) IN ('other_29')
      OR (qr.questionnaire_type = 'other' AND qr.original_question_id = 29)
      OR (us.questionnaire_type = 'other' AND qr.original_question_id = 29)
    )
    AND UPPER(
      SUBSTRING(
        TRIM(COALESCE(qr.response_text, qr.response_value, '')),
        1,
        1
      )
    ) IN ('A', 'B', 'C', 'D', 'E', 'F')
  ORDER BY qr.updated_at DESC NULLS LAST, qr.created_at DESC NULLS LAST, qr.id DESC
  LIMIT 1
) qr_ch ON TRUE
LEFT JOIN LATERAL (
  SELECT UPPER(
    SUBSTRING(
      TRIM(COALESCE(qr.response_text, qr.response_value, '')),
      1,
      1
    )
  ) AS ch
  FROM question_responses qr
  WHERE us.id = ANY (COALESCE(qr.user_session_ids, '{}'::uuid[]))
    AND qr.question_type = 'multiple-choice'
    AND NOT COALESCE(qr.is_text_response, FALSE)
    AND lower(btrim(qr.question_id::text)) = 'other_29'
    AND UPPER(
      SUBSTRING(
        TRIM(COALESCE(qr.response_text, qr.response_value, '')),
        1,
        1
      )
    ) IN ('A', 'B', 'C', 'D', 'E', 'F')
  ORDER BY
    CASE
      WHEN qr.original_question_id = 25 OR btrim(qr.original_question_id::text) = '25' THEN 0
      WHEN qr.original_question_id = 29 THEN 0
      ELSE 1
    END,
    qr.updated_at DESC NULLS LAST,
    qr.created_at DESC NULLS LAST,
    qr.id DESC
  LIMIT 1
) qr_final ON TRUE
LEFT JOIN LATERAL (
  SELECT UPPER(
    SUBSTRING(
      TRIM(COALESCE(qr.response_text, qr.response_value, '')),
      1,
      1
    )
  ) AS ch
  FROM question_responses qr
  WHERE us.id = ANY (COALESCE(qr.user_session_ids, '{}'::uuid[]))
    AND qr.question_type = 'multiple-choice'
    AND NOT COALESCE(qr.is_text_response, FALSE)
    AND (
      qr.original_question_id = 25
      OR btrim(qr.original_question_id::text) = '25'
      OR qr.original_question_id = 29
    )
    AND lower(btrim(qr.question_id::text)) = 'other_unified_25'
    AND UPPER(
      SUBSTRING(
        TRIM(COALESCE(qr.response_text, qr.response_value, '')),
        1,
        1
      )
    ) IN ('A', 'B', 'C', 'D', 'E', 'F')
  ORDER BY qr.updated_at DESC NULLS LAST, qr.created_at DESC NULLS LAST, qr.id DESC
  LIMIT 1
) u25 ON TRUE
WHERE us.questionnaire_type = 'other'
  AND EXISTS (
    SELECT 1
    FROM question_responses qr0
    WHERE us.id = ANY (COALESCE(qr0.user_session_ids, '{}'::uuid[]))
  )
  AND COALESCE(cm_ch.ch, ts_ch.ch, qr_ch.ch, qr_final.ch, u25.ch) IN ('A', 'B', 'C', 'D', 'E', 'F')
  AND NOT EXISTS (
    SELECT 1
    FROM question_responses qr
    WHERE qr.question_type = 'multiple-choice'
      AND NOT COALESCE(qr.is_text_response, FALSE)
      AND us.id = ANY (COALESCE(qr.user_session_ids, '{}'::uuid[]))
      AND qr.question_id::text = 'other_29'
      AND (
        qr.original_question_id = 25
        OR btrim(qr.original_question_id::text) = '25'
        OR qr.original_question_id = 29
      )
  );
