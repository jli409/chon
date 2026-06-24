-- =============================================================================
-- Q25 backfill — STEP 4 of 4: SYNC character_matches + tag_statistics (mutating)
-- =============================================================================
-- Previous: q25_backfill_03_insert_canonical_question_responses.sql
--
-- session_list includes sessions from tag_statistics, character_matches, AND
-- any session id appearing on a Q25-shaped question_responses row (fixes 0-row
-- updates when a user only has QR data).
--
-- q25_lookup reads Q25-shaped question_responses (same family as step 03).
-- Resolved letter = COALESCE(character_matches, tag_statistics, q25_lookup) — same
-- priority as step 3 INSERT (1). Step 4 used to be QR-only, which yielded 0 updates
-- whenever the letter lived only in CM/TS or QR rows failed the SQL shape filters.
-- UPDATEs skip rows where no A–F letter (avoids wiping answers).
-- Reads TRIM(COALESCE(response_text, response_value)); MC rows use is_text_response
-- = FALSE. Legacy Q25 rows use original_question_id 33/29/45 — matched via question_id
-- prefix when qr.questionnaire_type is NULL.
--
-- To dry-run: replace COMMIT with ROLLBACK;
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _chon_q25_resolved (
  user_session_id UUID PRIMARY KEY,
  q25_ch VARCHAR(1),
  bonus_tag VARCHAR(50)
) ON COMMIT DROP;

WITH
sessions_from_qr AS (
  SELECT DISTINCT u.uid::uuid AS user_session_id
  FROM question_responses qr
  CROSS JOIN LATERAL unnest(COALESCE(qr.user_session_ids, '{}'::uuid[])) AS u(uid)
  WHERE qr.question_type = 'multiple-choice'
    AND NOT COALESCE(qr.is_text_response, FALSE)
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
      OR (lower(split_part(qr.question_id::text, '_', 1)) = 'mother' AND qr.original_question_id = 33)
      OR (lower(split_part(qr.question_id::text, '_', 1)) = 'corporate' AND qr.original_question_id = 33)
      OR (lower(split_part(qr.question_id::text, '_', 1)) = 'other' AND qr.original_question_id = 29)
      OR (lower(split_part(qr.question_id::text, '_', 1)) = 'both' AND qr.original_question_id = 45)
      OR qr.question_id::text ~* '_unified_25$'
    )
    AND UPPER(
      SUBSTRING(
        TRIM(COALESCE(qr.response_text, qr.response_value, '')),
        1,
        1
      )
    ) IN ('A', 'B', 'C', 'D', 'E', 'F')
),
session_list AS (
  SELECT DISTINCT user_session_id
  FROM tag_statistics
  UNION
  SELECT DISTINCT user_session_id
  FROM character_matches
  WHERE user_session_id IS NOT NULL
  UNION
  SELECT user_session_id
  FROM sessions_from_qr
),
q25_lookup AS (
  SELECT DISTINCT ON (u.uid::uuid)
    u.uid::uuid AS user_session_id,
    UPPER(
      SUBSTRING(
        TRIM(COALESCE(qr.response_text, qr.response_value, '')),
        1,
        1
      )
    ) AS q25_ch
  FROM question_responses qr
  CROSS JOIN LATERAL unnest(COALESCE(qr.user_session_ids, '{}'::uuid[])) AS u(uid)
  INNER JOIN session_list s ON s.user_session_id = u.uid::uuid
  WHERE qr.question_type = 'multiple-choice'
    AND NOT COALESCE(qr.is_text_response, FALSE)
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
      OR (lower(split_part(qr.question_id::text, '_', 1)) = 'mother' AND qr.original_question_id = 33)
      OR (lower(split_part(qr.question_id::text, '_', 1)) = 'corporate' AND qr.original_question_id = 33)
      OR (lower(split_part(qr.question_id::text, '_', 1)) = 'other' AND qr.original_question_id = 29)
      OR (lower(split_part(qr.question_id::text, '_', 1)) = 'both' AND qr.original_question_id = 45)
      OR qr.question_id::text ~* '_unified_25$'
    )
    AND UPPER(
      SUBSTRING(
        TRIM(COALESCE(qr.response_text, qr.response_value, '')),
        1,
        1
      )
    ) IN ('A', 'B', 'C', 'D', 'E', 'F')
  ORDER BY u.uid::uuid, qr.updated_at DESC NULLS LAST, qr.created_at DESC NULLS LAST, qr.id DESC
)
INSERT INTO _chon_q25_resolved (user_session_id, q25_ch, bonus_tag)
SELECT
  s.user_session_id,
  COALESCE(
    CASE WHEN cm_ch.ch IN ('A', 'B', 'C', 'D', 'E', 'F') THEN cm_ch.ch END,
    CASE WHEN ts_ch.ch IN ('A', 'B', 'C', 'D', 'E', 'F') THEN ts_ch.ch END,
    CASE WHEN q.q25_ch IN ('A', 'B', 'C', 'D', 'E', 'F') THEN q.q25_ch END
  ) AS q25_ch,
  CASE COALESCE(
    CASE WHEN cm_ch.ch IN ('A', 'B', 'C', 'D', 'E', 'F') THEN cm_ch.ch END,
    CASE WHEN ts_ch.ch IN ('A', 'B', 'C', 'D', 'E', 'F') THEN ts_ch.ch END,
    CASE WHEN q.q25_ch IN ('A', 'B', 'C', 'D', 'E', 'F') THEN q.q25_ch END
  )
    WHEN 'A' THEN 'dedication'
    WHEN 'B' THEN 'emotionalRegulation'
    WHEN 'C' THEN 'selfAwareness'
    WHEN 'D' THEN 'socialIntelligence'
    WHEN 'E' THEN 'coreEndurance'
    WHEN 'F' THEN 'objectivity'
    ELSE NULL
  END AS bonus_tag
FROM session_list s
LEFT JOIN q25_lookup q ON q.user_session_id = s.user_session_id
LEFT JOIN LATERAL (
  SELECT UPPER(SUBSTRING(TRIM(cm.question_25_answer), 1, 1)) AS ch
  FROM character_matches cm
  WHERE cm.user_session_id = s.user_session_id
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
    WHERE ts.user_session_id = s.user_session_id
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
) ts_ch ON TRUE;

UPDATE character_matches cm
SET question_25_answer = r.q25_ch
FROM _chon_q25_resolved r
WHERE cm.user_session_id = r.user_session_id
  AND r.q25_ch IS NOT NULL;

UPDATE tag_statistics ts
SET
  question_25_bonus_applied = (
    r.bonus_tag IS NOT NULL
    AND ts.tag_english = r.bonus_tag
  ),
  question_25_bonus_tag = CASE
    WHEN r.bonus_tag IS NOT NULL AND ts.tag_english = r.bonus_tag THEN r.bonus_tag
    ELSE NULL
  END
FROM _chon_q25_resolved r
WHERE ts.user_session_id = r.user_session_id
  AND r.q25_ch IS NOT NULL;

COMMIT;
