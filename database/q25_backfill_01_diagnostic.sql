-- =============================================================================
-- Q25 backfill — STEP 1 of 4: DIAGNOSTIC (read-only)
-- =============================================================================
-- Next: q25_backfill_02_preview.sql
-- =============================================================================

WITH sess AS (
  SELECT us.id AS user_session_id,
    us.questionnaire_type,
    CASE us.questionnaire_type
      WHEN 'mother' THEN 'mother_33'
      WHEN 'corporate' THEN 'corporate_33'
      WHEN 'other' THEN 'other_29'
      WHEN 'both' THEN 'both_45'
    END AS final_qid
  FROM user_sessions us
  WHERE us.questionnaire_type IN ('mother', 'corporate', 'other', 'both')
),
-- Final-slot row: mother_33 | … | both_45 with unified oid 25 OR legacy last-index oid
has_final_slot_q25 AS (
  SELECT DISTINCT s.user_session_id
  FROM sess s
  INNER JOIN question_responses qr ON qr.question_type = 'multiple-choice'
    AND NOT COALESCE(qr.is_text_response, FALSE)
    AND s.user_session_id = ANY (COALESCE(qr.user_session_ids, '{}'::uuid[]))
    AND qr.question_id::text = s.final_qid
    AND (
      qr.original_question_id = 25
      OR btrim(qr.original_question_id::text) = '25'
      OR (s.questionnaire_type = 'mother' AND qr.original_question_id = 33)
      OR (s.questionnaire_type = 'corporate' AND qr.original_question_id = 33)
      OR (s.questionnaire_type = 'other' AND qr.original_question_id = 29)
      OR (s.questionnaire_type = 'both' AND qr.original_question_id = 45)
    )
),
-- Legacy per-session row (still need to materialize final_slot)
has_unified_25_row AS (
  SELECT DISTINCT s.user_session_id
  FROM sess s
  INNER JOIN question_responses qr ON qr.question_type = 'multiple-choice'
    AND NOT COALESCE(qr.is_text_response, FALSE)
    AND s.user_session_id = ANY (COALESCE(qr.user_session_ids, '{}'::uuid[]))
    AND lower(qr.question_id::text) = lower(s.questionnaire_type::text || '_unified_25')
    AND (
      qr.original_question_id = 25
      OR btrim(qr.original_question_id::text) = '25'
      OR (s.questionnaire_type = 'mother' AND qr.original_question_id = 33)
      OR (s.questionnaire_type = 'corporate' AND qr.original_question_id = 33)
      OR (s.questionnaire_type = 'other' AND qr.original_question_id = 29)
      OR (s.questionnaire_type = 'both' AND qr.original_question_id = 45)
    )
),
cm_letter AS (
  SELECT DISTINCT ON (cm.user_session_id)
    cm.user_session_id,
    UPPER(SUBSTRING(TRIM(cm.question_25_answer), 1, 1)) AS ch
  FROM character_matches cm
  WHERE cm.question_25_answer IS NOT NULL
    AND btrim(cm.question_25_answer) <> ''
  ORDER BY cm.user_session_id, cm.match_rank ASC NULLS LAST
),
ts_letter AS (
  SELECT DISTINCT ON (ts.user_session_id)
    ts.user_session_id,
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
  WHERE (
      COALESCE(ts.question_25_bonus_applied, FALSE)
      OR (
        ts.question_25_bonus_tag IS NOT NULL
        AND btrim(ts.question_25_bonus_tag::text) <> ''
      )
    )
    AND CASE COALESCE(
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
    END IS NOT NULL
  ORDER BY ts.user_session_id,
    COALESCE(ts.question_25_bonus_applied, FALSE) DESC,
    ts.created_at DESC NULLS LAST,
    ts.id DESC
),
qr_letter AS (
  SELECT DISTINCT ON (sid.uid)
    sid.uid AS user_session_id,
    UPPER(
      SUBSTRING(
        TRIM(COALESCE(qr.response_text, qr.response_value, '')),
        1,
        1
      )
    ) AS ch
  FROM question_responses qr
  CROSS JOIN LATERAL unnest(COALESCE(qr.user_session_ids, '{}'::uuid[])) AS sid(uid)
  INNER JOIN user_sessions us ON us.id = sid.uid
    AND us.questionnaire_type IN ('mother', 'corporate', 'other', 'both')
  WHERE qr.question_type = 'multiple-choice'
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
      OR qr.question_id::text IN ('mother_33', 'corporate_33', 'other_29', 'both_45')
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
  ORDER BY sid.uid, qr.updated_at DESC NULLS LAST, qr.created_at DESC NULLS LAST, qr.id DESC
)
SELECT
  (SELECT COUNT(*) FROM sess) AS sessions_typed,
  (SELECT COUNT(*) FROM has_final_slot_q25) AS sessions_have_canonical_final_q25,
  (SELECT COUNT(*) FROM has_unified_25_row) AS sessions_have_unified_25_row,
  (SELECT COUNT(*) FROM sess s WHERE NOT EXISTS (
    SELECT 1 FROM has_final_slot_q25 h WHERE h.user_session_id = s.user_session_id
  )) AS missing_final_slot_other_29_etc,
  (SELECT COUNT(*) FROM sess s
    WHERE NOT EXISTS (SELECT 1 FROM has_final_slot_q25 h WHERE h.user_session_id = s.user_session_id)
      AND EXISTS (SELECT 1 FROM has_unified_25_row u WHERE u.user_session_id = s.user_session_id)
  ) AS missing_final_but_have_unified_25,
  (SELECT COUNT(*) FROM sess s
    WHERE NOT EXISTS (SELECT 1 FROM has_final_slot_q25 h WHERE h.user_session_id = s.user_session_id)
      AND EXISTS (SELECT 1 FROM cm_letter c WHERE c.user_session_id = s.user_session_id)
  ) AS missing_final_but_cm_letter,
  (SELECT COUNT(*) FROM sess s
    WHERE NOT EXISTS (SELECT 1 FROM has_final_slot_q25 h WHERE h.user_session_id = s.user_session_id)
      AND EXISTS (SELECT 1 FROM ts_letter t WHERE t.user_session_id = s.user_session_id)
  ) AS missing_final_but_ts_letter,
  (SELECT COUNT(*) FROM sess s
    WHERE NOT EXISTS (SELECT 1 FROM has_final_slot_q25 h WHERE h.user_session_id = s.user_session_id)
      AND EXISTS (SELECT 1 FROM qr_letter q WHERE q.user_session_id = s.user_session_id)
  ) AS missing_final_but_qr_letter;
