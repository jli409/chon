-- =============================================================================
-- Q25 backfill — STEP 3 of 4: INSERT canonical question_responses (mutating)
-- =============================================================================
-- Previous: q25_backfill_02_preview.sql
-- Next:     q25_backfill_04_sync_character_matches_tag_statistics.sql
--
-- Rebuilds the same working set as step 02 (typed sessions with any question_responses
-- link and/or CM Q25 answer and/or tag_statistics Q25 bonus columns), then runs two
-- INSERTs only for those sessions.
--
-- (1) INSERT from CM / tag_statistics / Q25-shaped question_responses / final-slot id
-- (2) INSERT copy from {type}_unified_25 when final row still missing
--
-- Skips when a final-slot row already exists (mother_33 / … / both_45) with
-- original_question_id = 25 (unified) OR legacy last-index oids (33/29/45).
--
-- Source rows often use legacy original_question_id (e.g. 33 for mother) — those
-- are matched using user_sessions.questionnaire_type, not qr.questionnaire_type.
-- New canonical rows still use original_question_id = 25.
--
-- Reads TRIM(COALESCE(response_text, response_value)); is_text_response must be
-- FALSE for MC. New rows set both response_value and response_text to the letter.
-- =============================================================================

DROP TABLE IF EXISTS _chon_q25_preview_sessions;

CREATE TEMP TABLE _chon_q25_preview_sessions AS
SELECT DISTINCT
  us.id AS user_session_id,
  us.questionnaire_type
FROM user_sessions us
WHERE us.questionnaire_type IN ('mother', 'corporate', 'other', 'both')
  AND (
    EXISTS (
      SELECT 1
      FROM question_responses qr
      WHERE us.id = ANY (COALESCE(qr.user_session_ids, '{}'::uuid[]))
    )
    OR EXISTS (
      SELECT 1
      FROM character_matches cm
      WHERE cm.user_session_id = us.id
        AND cm.question_25_answer IS NOT NULL
        AND btrim(cm.question_25_answer) <> ''
    )
    OR EXISTS (
      SELECT 1
      FROM tag_statistics ts
      WHERE ts.user_session_id = us.id
        AND (
          COALESCE(ts.question_25_bonus_applied, FALSE)
          OR (
            ts.question_25_bonus_tag IS NOT NULL
            AND btrim(ts.question_25_bonus_tag::text) <> ''
          )
        )
    )
  );

-- -----------------------------------------------------------------------------
-- (1) INSERT from CM / TS / QR (preview_sessions only)
-- -----------------------------------------------------------------------------
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
  us.questionnaire_type,
  CASE us.questionnaire_type
    WHEN 'mother' THEN 'mother_33'
    WHEN 'corporate' THEN 'corporate_33'
    WHEN 'other' THEN 'other_29'
    WHEN 'both' THEN 'both_45'
  END,
  25,
  'multiple-choice',
  COALESCE(cm_ch.ch, ts_ch.ch, qr_ch.ch, qr_final.ch),
  COALESCE(cm_ch.ch, ts_ch.ch, qr_ch.ch, qr_final.ch),
  FALSE,
  ARRAY[us.id]::uuid[]
FROM _chon_q25_preview_sessions s
INNER JOIN user_sessions us ON us.id = s.user_session_id
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
      OR qr.questionnaire_type = us.questionnaire_type
      OR lower(split_part(qr.question_id::text, '_', 1)) = us.questionnaire_type::text
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
      OR lower(btrim(qr.question_id::text)) IN (
        'mother_33', 'corporate_33', 'other_29', 'both_45'
      )
      OR (us.questionnaire_type = 'mother' AND qr.original_question_id = 33)
      OR (us.questionnaire_type = 'corporate' AND qr.original_question_id = 33)
      OR (us.questionnaire_type = 'other' AND qr.original_question_id = 29)
      OR (us.questionnaire_type = 'both' AND qr.original_question_id = 45)
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
    AND lower(btrim(qr.question_id::text)) = lower(
      CASE us.questionnaire_type
        WHEN 'mother' THEN 'mother_33'
        WHEN 'corporate' THEN 'corporate_33'
        WHEN 'other' THEN 'other_29'
        WHEN 'both' THEN 'both_45'
      END
    )
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
      WHEN us.questionnaire_type = 'mother' AND qr.original_question_id = 33 THEN 0
      WHEN us.questionnaire_type = 'corporate' AND qr.original_question_id = 33 THEN 0
      WHEN us.questionnaire_type = 'other' AND qr.original_question_id = 29 THEN 0
      WHEN us.questionnaire_type = 'both' AND qr.original_question_id = 45 THEN 0
      ELSE 1
    END,
    qr.updated_at DESC NULLS LAST,
    qr.created_at DESC NULLS LAST,
    qr.id DESC
  LIMIT 1
) qr_final ON TRUE
WHERE COALESCE(cm_ch.ch, ts_ch.ch, qr_ch.ch, qr_final.ch) IN ('A', 'B', 'C', 'D', 'E', 'F')
  AND NOT EXISTS (
    SELECT 1
    FROM question_responses qr
    WHERE qr.question_type = 'multiple-choice'
      AND NOT COALESCE(qr.is_text_response, FALSE)
      AND us.id = ANY (COALESCE(qr.user_session_ids, '{}'::uuid[]))
      AND qr.question_id::text = CASE us.questionnaire_type
        WHEN 'mother' THEN 'mother_33'
        WHEN 'corporate' THEN 'corporate_33'
        WHEN 'other' THEN 'other_29'
        WHEN 'both' THEN 'both_45'
      END
      AND (
        qr.original_question_id = 25
        OR btrim(qr.original_question_id::text) = '25'
        OR (us.questionnaire_type = 'mother' AND qr.original_question_id = 33)
        OR (us.questionnaire_type = 'corporate' AND qr.original_question_id = 33)
        OR (us.questionnaire_type = 'other' AND qr.original_question_id = 29)
        OR (us.questionnaire_type = 'both' AND qr.original_question_id = 45)
      )
  );

-- -----------------------------------------------------------------------------
-- (2) Copy from {type}_unified_25 (preview_sessions only)
-- -----------------------------------------------------------------------------
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
  us.questionnaire_type,
  CASE us.questionnaire_type
    WHEN 'mother' THEN 'mother_33'
    WHEN 'corporate' THEN 'corporate_33'
    WHEN 'other' THEN 'other_29'
    WHEN 'both' THEN 'both_45'
  END,
  25,
  'multiple-choice',
  u25.ch,
  u25.ch,
  FALSE,
  ARRAY[us.id]::uuid[]
FROM _chon_q25_preview_sessions s
INNER JOIN user_sessions us ON us.id = s.user_session_id
INNER JOIN LATERAL (
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
      OR (us.questionnaire_type = 'mother' AND qr.original_question_id = 33)
      OR (us.questionnaire_type = 'corporate' AND qr.original_question_id = 33)
      OR (us.questionnaire_type = 'other' AND qr.original_question_id = 29)
      OR (us.questionnaire_type = 'both' AND qr.original_question_id = 45)
    )
    AND lower(btrim(qr.question_id::text)) = lower(us.questionnaire_type::text || '_unified_25')
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
WHERE NOT EXISTS (
    SELECT 1
    FROM question_responses qr
    WHERE qr.question_type = 'multiple-choice'
      AND NOT COALESCE(qr.is_text_response, FALSE)
      AND us.id = ANY (COALESCE(qr.user_session_ids, '{}'::uuid[]))
      AND qr.question_id::text = CASE us.questionnaire_type
        WHEN 'mother' THEN 'mother_33'
        WHEN 'corporate' THEN 'corporate_33'
        WHEN 'other' THEN 'other_29'
        WHEN 'both' THEN 'both_45'
      END
      AND (
        qr.original_question_id = 25
        OR btrim(qr.original_question_id::text) = '25'
        OR (us.questionnaire_type = 'mother' AND qr.original_question_id = 33)
        OR (us.questionnaire_type = 'corporate' AND qr.original_question_id = 33)
        OR (us.questionnaire_type = 'other' AND qr.original_question_id = 29)
        OR (us.questionnaire_type = 'both' AND qr.original_question_id = 45)
      )
  );
