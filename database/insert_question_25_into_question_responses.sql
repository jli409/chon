-- =============================================================================
-- Insert unified Q25 into question_responses (canonical MC row)
-- =============================================================================
-- Shape matches the app: question_id = final local slot, original_question_id = 25,
-- question_type = multiple-choice, response_value/response_text = A–F,
-- user_session_ids = ARRAY[session_id], is_text_response = FALSE.
--
-- A) Manual one row (replace placeholders):
--
INSERT INTO question_responses (
   questionnaire_type,
   question_id,
   original_question_id,
   question_type,
   response_value,
   response_text,
   is_text_response,
   user_session_ids
 ) VALUES (
   'other',                    -- mother | corporate | other | both
  'other_29',                 -- mother_33 | corporate_33 | other_29 | both_45
   25,
   'multiple-choice',
   'A',                         -- A–F
   'A',
   FALSE,
   ARRAY['00000000-0000-0000-0000-000000000000'::uuid]  -- user_sessions.id
 );
--
-- B) Bulk: completed sessions only — builds letter from QR (preferred), final-slot QR,
--    character_matches, tag_statistics; skips if canonical row already exists.
--    Dry-run: use ROLLBACK instead of COMMIT.
--
-- To also sync character_matches + tag_statistics after insert, run instead:
--   insert_canonical_q25_completed_sessions_and_sync.sql
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS _chon_completed_q25_sessions;

CREATE TEMP TABLE _chon_completed_q25_sessions ON COMMIT DROP AS
SELECT DISTINCT
  us.id AS user_session_id,
  us.questionnaire_type
FROM user_sessions us
WHERE us.questionnaire_type IN ('mother', 'corporate', 'other', 'both')
  AND COALESCE(us.questionnaire_completed, FALSE) IS TRUE
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

-- (1) INSERT from CM / TS / QR
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
  COALESCE(qr_ch.ch, qr_final.ch, cm_ch.ch, ts_ch.ch),
  COALESCE(qr_ch.ch, qr_final.ch, cm_ch.ch, ts_ch.ch),
  FALSE,
  ARRAY[us.id]::uuid[]
FROM _chon_completed_q25_sessions s
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
      -- Match final-slot id even when qr.questionnaire_type is wrong/missing (common for "other" + other_29)
      OR lower(btrim(qr.question_id::text)) = lower(
        CASE us.questionnaire_type
          WHEN 'mother' THEN 'mother_33'
          WHEN 'corporate' THEN 'corporate_33'
          WHEN 'other' THEN 'other_29'
          WHEN 'both' THEN 'both_45'
        END
      )
    )
    AND (
      qr.original_question_id = 25
      OR btrim(qr.original_question_id::text) = '25'
      OR qr.question_id::text = '25'
      OR qr.question_id::text ~ '_25$'
      OR qr.question_id::text ~* '_unified_25$'
      OR (
        SUBSTRING(qr.question_id::text FROM '([0-9]+)$') IS NOT NULL
        AND (SUBSTRING(qr.question_id::text FROM '([0-9]+)$'))::int = 25
      )
      OR lower(btrim(qr.question_id::text)) IN (
        'mother_33', 'corporate_33', 'other_29', 'both_45'
      )
      OR lower(btrim(qr.question_id::text)) = lower(us.questionnaire_type::text || '_unified_25')
      OR (us.questionnaire_type = 'mother' AND qr.original_question_id = 33)
      OR (us.questionnaire_type = 'corporate' AND qr.original_question_id = 33)
      OR (
        us.questionnaire_type = 'other'
        AND (
          qr.original_question_id = 29
          OR btrim(qr.original_question_id::text) IN ('29', '25')
        )
      )
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
      WHEN us.questionnaire_type = 'other' AND (
        qr.original_question_id = 29
        OR btrim(qr.original_question_id::text) IN ('29', '25')
      ) THEN 0
      WHEN us.questionnaire_type = 'both' AND qr.original_question_id = 45 THEN 0
      ELSE 1
    END,
    qr.updated_at DESC NULLS LAST,
    qr.created_at DESC NULLS LAST,
    qr.id DESC
  LIMIT 1
) qr_final ON TRUE
WHERE COALESCE(qr_ch.ch, qr_final.ch, cm_ch.ch, ts_ch.ch) IN ('A', 'B', 'C', 'D', 'E', 'F')
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
      )
  );

-- (2) Second pass: unified_25 row only, if canonical final-slot row still missing
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
FROM _chon_completed_q25_sessions s
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
      OR (
        us.questionnaire_type = 'other'
        AND (
          qr.original_question_id = 29
          OR btrim(qr.original_question_id::text) IN ('29', '25')
        )
      )
      OR (us.questionnaire_type = 'both' AND qr.original_question_id = 45)
    )
    AND (
      lower(btrim(qr.question_id::text)) = lower(us.questionnaire_type::text || '_unified_25')
      OR (
        us.questionnaire_type = 'other'
        AND lower(btrim(qr.question_id::text)) = 'other_29'
      )
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
    )
);

COMMIT;
