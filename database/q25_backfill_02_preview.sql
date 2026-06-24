-- =============================================================================
-- Q25 backfill — STEP 2 of 4: PREVIEW (read-only)
-- =============================================================================
-- Previous: q25_backfill_01_diagnostic.sql
-- Next:     q25_backfill_03_insert_canonical_question_responses.sql
--
-- RUN THIS FILE AS ONE SCRIPT (same SQL editor / connection).
--
-- 1) Builds temp table _chon_q25_preview_sessions: typed user_sessions that have
--    any question_responses row, OR character_matches Q25 answer, OR tag_statistics
--    Q25 bonus columns (covers sessions with no question_responses at all).
-- 2) SELECT * from that table (your “generated table”).
-- 3) (0) DEBUG / (1)(2) PREVIEW — all restricted to those sessions only.
--
-- Optional cleanup (same session): DROP TABLE IF EXISTS _chon_q25_preview_sessions;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Build working set: sessions with QR and/or CM/TS Q25 signal
-- -----------------------------------------------------------------------------
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

-- Generated table (working set)
SELECT * FROM _chon_q25_preview_sessions ORDER BY user_session_id;

SELECT COUNT(*) AS preview_session_count FROM _chon_q25_preview_sessions;

-- -----------------------------------------------------------------------------
-- (0) DEBUG: among preview sessions, missing canonical final row — source flags
-- -----------------------------------------------------------------------------
SELECT
  us.id AS user_session_id,
  us.questionnaire_type,
  EXISTS (
    SELECT 1
    FROM character_matches cm
    WHERE cm.user_session_id = us.id
      AND cm.question_25_answer IS NOT NULL
      AND btrim(cm.question_25_answer) <> ''
  ) AS has_character_matches_q25_answer,
  EXISTS (
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
  ) AS has_tag_statistics_q25_columns,
  EXISTS (
    SELECT 1
    FROM question_responses qr
    WHERE us.id = ANY (COALESCE(qr.user_session_ids, '{}'::uuid[]))
      AND lower(btrim(qr.question_id::text)) = lower(
        us.questionnaire_type::text || '_unified_25'
      )
  ) AS has_question_response_unified_25_id,
  EXISTS (
    SELECT 1
    FROM question_responses qr
    WHERE us.id = ANY (COALESCE(qr.user_session_ids, '{}'::uuid[]))
      AND lower(btrim(qr.question_id::text)) = lower(
        CASE us.questionnaire_type
          WHEN 'mother' THEN 'mother_33'
          WHEN 'corporate' THEN 'corporate_33'
          WHEN 'other' THEN 'other_29'
          WHEN 'both' THEN 'both_45'
        END
      )
  ) AS has_question_response_final_slot_id,
  EXISTS (
    SELECT 1
    FROM question_responses qr
    WHERE us.id = ANY (COALESCE(qr.user_session_ids, '{}'::uuid[]))
  ) AS has_any_question_response_row
FROM _chon_q25_preview_sessions s
INNER JOIN user_sessions us ON us.id = s.user_session_id
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
  )
ORDER BY us.id
LIMIT 500;

-- -----------------------------------------------------------------------------
-- (1) PREVIEW: rows step 3 INSERT (1) would add (preview_sessions only)
-- -----------------------------------------------------------------------------
SELECT
  us.id AS user_session_id,
  us.questionnaire_type,
  CASE us.questionnaire_type
    WHEN 'mother' THEN 'mother_33'
    WHEN 'corporate' THEN 'corporate_33'
    WHEN 'other' THEN 'other_29'
    WHEN 'both' THEN 'both_45'
  END AS question_id,
  COALESCE(cm_ch.ch, ts_ch.ch, qr_ch.ch, qr_final.ch) AS response_value,
  cm_ch.ch AS from_character_matches,
  ts_ch.ch AS from_tag_statistics,
  qr_ch.ch AS from_question_responses_shaped,
  qr_final.ch AS from_question_responses_final_slot_id
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
-- (2) PREVIEW: rows step 3 INSERT (2) would add — copy from *_unified_25
-- -----------------------------------------------------------------------------
SELECT
  us.id AS user_session_id,
  us.questionnaire_type,
  CASE us.questionnaire_type
    WHEN 'mother' THEN 'mother_33'
    WHEN 'corporate' THEN 'corporate_33'
    WHEN 'other' THEN 'other_29'
    WHEN 'both' THEN 'both_45'
  END AS question_id,
  u25.ch AS response_value,
  'from_unified_25_row'::text AS source
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
