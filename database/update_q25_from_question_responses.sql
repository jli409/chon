-- =============================================================================
-- Sync Q25 from question_responses → character_matches + tag_statistics flags
-- =============================================================================
--
-- Scope: every user_session_id that appears in tag_statistics OR character_matches.
-- To limit to specific UUIDs, replace session_list with:
--   SELECT unnest(ARRAY['uuid1'::uuid, 'uuid2'::uuid]) AS user_session_id
--
-- For each session, picks the latest non-text Q25 row from question_responses
-- (aligned with application.py fetch_question_25_choice_for_session + Q25_ANSWER_TO_TAG).
--
-- NOTE: unified Q25 is the *last* question in each flow, so older rows often have
-- original_question_id = 33 / 29 / 45. New saves also write a canonical row with
-- original_question_id = 25 (see application.py). For historic gaps, run
-- database/q25_backfill_01..03 then database/q25_backfill_04_sync_character_matches_tag_statistics.sql
-- or this script's APPLY section (same sync intent).
--
-- Updates:
--   - character_matches.question_25_answer → 'A'..'F' or NULL
--   - tag_statistics.question_25_bonus_applied / question_25_bonus_tag
--       TRUE + bonus tag only where tag_english matches the Q25-derived tag;
--       all other tag rows for that session → FALSE / NULL.
--
-- Does NOT change score_percentage or user_score. Re-run your backfill if those
-- must match a freshly applied +10% bonus.
--
-- BEFORE YOU RUN: PREVIEW only, then BEGIN … ROLLBACK; then COMMIT.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- DIAGNOSTIC: see what Q25-shaped rows actually exist (run standalone)
-- -----------------------------------------------------------------------------
-- SELECT
--   questionnaire_type,
--   original_question_id,
--   question_id,
--   question_type,
--   is_text_response,
--   response_value,
--   response_text,
--   cardinality(user_session_ids) AS n_sessions
-- FROM question_responses
-- WHERE question_type = 'multiple-choice'
--   AND NOT COALESCE(is_text_response, FALSE)
--   AND (
--     original_question_id IN (25, 29, 33, 45)
--     OR question_id::text IN ('mother_33', 'corporate_33', 'other_29', 'both_45')
--   )
-- ORDER BY questionnaire_type, original_question_id, question_id;

-- -----------------------------------------------------------------------------
-- PREVIEW
-- -----------------------------------------------------------------------------
WITH session_list AS (
  SELECT DISTINCT user_session_id
  FROM tag_statistics
  UNION
  SELECT DISTINCT user_session_id
  FROM character_matches
),
q25_lookup AS (
  SELECT DISTINCT ON (u.uid::uuid)
    u.uid::uuid AS user_session_id,
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
    ) AS q25_ch
  FROM question_responses qr
  CROSS JOIN LATERAL unnest(qr.user_session_ids) AS u(uid)
  INNER JOIN session_list s ON s.user_session_id = u.uid::uuid
  WHERE NOT COALESCE(qr.is_text_response, FALSE)
    AND qr.question_type = 'multiple-choice'
    AND (
      qr.original_question_id = 25
      OR qr.question_id::text IN ('mother_33', 'corporate_33', 'other_29', 'both_45')
      OR (
        qr.questionnaire_type = 'mother'
        AND qr.original_question_id = 33
      )
      OR (
        qr.questionnaire_type = 'corporate'
        AND qr.original_question_id = 33
      )
      OR (
        qr.questionnaire_type = 'other'
        AND qr.original_question_id = 29
      )
      OR (
        qr.questionnaire_type = 'both'
        AND qr.original_question_id = 45
      )
    )
    AND UPPER(
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
    ) IN ('A', 'B', 'C', 'D', 'E', 'F')
  ORDER BY u.uid::uuid, qr.updated_at DESC NULLS LAST, qr.created_at DESC, qr.id DESC
)
SELECT
  s.user_session_id,
  q.q25_ch,
  CASE q.q25_ch
    WHEN 'A' THEN 'dedication'
    WHEN 'B' THEN 'emotionalRegulation'
    WHEN 'C' THEN 'selfAwareness'
    WHEN 'D' THEN 'socialIntelligence'
    WHEN 'E' THEN 'coreEndurance'
    WHEN 'F' THEN 'objectivity'
  END AS bonus_tag
FROM session_list s
LEFT JOIN q25_lookup q ON q.user_session_id = s.user_session_id
ORDER BY s.user_session_id;

-- =============================================================================
-- APPLY
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _chon_q25_resolved (
  user_session_id UUID PRIMARY KEY,
  q25_ch VARCHAR(1),
  bonus_tag VARCHAR(50)
) ON COMMIT DROP;

WITH session_list AS (
  SELECT DISTINCT user_session_id
  FROM tag_statistics
  UNION
  SELECT DISTINCT user_session_id
  FROM character_matches
),
q25_lookup AS (
  SELECT DISTINCT ON (u.uid::uuid)
    u.uid::uuid AS user_session_id,
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
    ) AS q25_ch
  FROM question_responses qr
  CROSS JOIN LATERAL unnest(qr.user_session_ids) AS u(uid)
  INNER JOIN session_list s ON s.user_session_id = u.uid::uuid
  WHERE NOT COALESCE(qr.is_text_response, FALSE)
    AND qr.question_type = 'multiple-choice'
    AND (
      qr.original_question_id = 25
      OR qr.question_id::text IN ('mother_33', 'corporate_33', 'other_29', 'both_45')
      OR (
        qr.questionnaire_type = 'mother'
        AND qr.original_question_id = 33
      )
      OR (
        qr.questionnaire_type = 'corporate'
        AND qr.original_question_id = 33
      )
      OR (
        qr.questionnaire_type = 'other'
        AND qr.original_question_id = 29
      )
      OR (
        qr.questionnaire_type = 'both'
        AND qr.original_question_id = 45
      )
    )
    AND UPPER(
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
    ) IN ('A', 'B', 'C', 'D', 'E', 'F')
  ORDER BY u.uid::uuid, qr.updated_at DESC NULLS LAST, qr.created_at DESC, qr.id DESC
)
INSERT INTO _chon_q25_resolved (user_session_id, q25_ch, bonus_tag)
SELECT
  s.user_session_id,
  q.q25_ch,
  CASE q.q25_ch
    WHEN 'A' THEN 'dedication'
    WHEN 'B' THEN 'emotionalRegulation'
    WHEN 'C' THEN 'selfAwareness'
    WHEN 'D' THEN 'socialIntelligence'
    WHEN 'E' THEN 'coreEndurance'
    WHEN 'F' THEN 'objectivity'
  END
FROM session_list s
LEFT JOIN q25_lookup q ON q.user_session_id = s.user_session_id;

UPDATE character_matches cm
SET question_25_answer = r.q25_ch
FROM _chon_q25_resolved r
WHERE cm.user_session_id = r.user_session_id;

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
WHERE ts.user_session_id = r.user_session_id;

-- ROLLBACK;
COMMIT;
