-- =============================================================================
-- Backfill / repair: question_25_bonus_*, email_verified, character_matches Q25
-- =============================================================================
-- Fixes cases where no question_responses rows matched, e.g.:
--   - Q25 only in response_text, or first letter after trim is A–F
--   - question_id ends with _25 / trailing numeric 25
--   - original_question_id stored inconsistently
--   - Fallback: infer letter from tag_statistics.question_25_bonus_* BEFORE they are cleared
--
-- Q25 letter → bonus tag matches application.py Q25_ANSWER_TO_TAG.
--
-- Order:
--   (0a0) email_verifications: is_verified from verified_at (when flag was never set)
--   (0a)  email_verifications ← user_sessions.email_verified (only if sessions were already TRUE)
--   (0b)  email_verifications.questionnaire_type ← latest user_sessions
--   (1)    user_sessions.email_verified ↔ email_verifications
--   (2) snapshot merged Q25 (question_responses + tag_statistics + character_matches)
--   (3) INSERT missing question_responses for unified Q25
--   (4) clear + set tag_statistics bonus columns from snapshot
--   (5) character_matches.question_25_answer from snapshot
--
-- WARNING: Clears question_25_bonus_* on all tag_statistics, then reapplies from snapshot.
--
-- Section 1b joins email_verifications on email (not user_session_id); the app
-- stores verification rows keyed by email. If you have no email_verifications
-- table, comment out section 1b.
--
-- If is_verified AND user_sessions.email_verified are FALSE everywhere AND
-- verified_at is NULL everywhere, the DB never recorded a successful verify
-- (e.g. GET /email/verify/<token> failed silently before the code fix). SQL
-- cannot infer who clicked the link—use redeployed API + manual rows, or
-- Supabase Auth if that is your source of truth.
--
-- Preview (run once in SQL editor):
--   SELECT COUNT(*) FILTER (WHERE is_verified) AS ev_true,
--          COUNT(*) FILTER (WHERE verified_at IS NOT NULL) AS ev_has_verified_at
--   FROM email_verifications;
--   SELECT COUNT(*) FILTER (WHERE email_verified) AS us_true FROM user_sessions;
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0a0) email_verifications: set is_verified when verified_at was stored but flag was not
--      (common partial-failure mode; also makes section 1b useful afterward)
-- -----------------------------------------------------------------------------
UPDATE email_verifications ev
SET is_verified = TRUE
WHERE ev.verified_at IS NOT NULL
  AND COALESCE(ev.is_verified, FALSE) IS NOT TRUE;

-- -----------------------------------------------------------------------------
-- 0a) STRICT: DO NOT infer click from user_sessions.email_verified.
--     Only keep section 0a0 (verified_at => is_verified). If verified_at is NULL,
--     leave is_verified as-is unless manually repaired.
-- -----------------------------------------------------------------------------
-- UPDATE email_verifications ev
-- SET
--   is_verified = TRUE,
--   verified_at = COALESCE(ev.verified_at, NOW())
-- FROM user_sessions us
-- WHERE us.email IS NOT NULL
--   AND TRIM(us.email) <> ''
--   AND COALESCE(us.email_verified, FALSE) IS TRUE
--   AND ev.email IS NOT NULL
--   AND TRIM(ev.email) <> ''
--   AND LOWER(TRIM(ev.email)) = LOWER(TRIM(us.email))
--   AND COALESCE(ev.is_verified, FALSE) IS NOT TRUE;

-- -----------------------------------------------------------------------------
-- 0b) email_verifications.questionnaire_type from latest user_sessions row per email
-- -----------------------------------------------------------------------------
UPDATE email_verifications ev
SET questionnaire_type = lt.questionnaire_type
FROM (
  SELECT DISTINCT ON (LOWER(TRIM(email)))
    LOWER(TRIM(email)) AS norm_email,
    questionnaire_type
  FROM user_sessions
  WHERE email IS NOT NULL
    AND TRIM(email) <> ''
    AND questionnaire_type IS NOT NULL
    AND questionnaire_type IN ('mother', 'corporate', 'other', 'both')
  ORDER BY LOWER(TRIM(email)), created_at DESC NULLS LAST, id DESC
) lt
WHERE ev.email IS NOT NULL
  AND TRIM(ev.email) <> ''
  AND LOWER(TRIM(ev.email)) = lt.norm_email
  AND lt.questionnaire_type IS NOT NULL
  AND (
    ev.questionnaire_type IS NULL
    OR ev.questionnaire_type <> lt.questionnaire_type
  );

-- -----------------------------------------------------------------------------
-- 1a) email_verified: never TRUE without an email on the session
-- -----------------------------------------------------------------------------
UPDATE user_sessions
SET email_verified = FALSE
WHERE COALESCE(email_verified, FALSE) IS TRUE
  AND (email IS NULL OR TRIM(email) = '');

-- -----------------------------------------------------------------------------
-- 1b) email_verified: TRUE when email_verifications has is_verified for this email
--     (application.py links verification by email, not user_session_id.)
-- -----------------------------------------------------------------------------
UPDATE user_sessions us
SET email_verified = TRUE
WHERE us.email IS NOT NULL
  AND TRIM(us.email) <> ''
  AND EXISTS (
    SELECT 1
    FROM email_verifications ev
    WHERE ev.email IS NOT NULL
      AND TRIM(ev.email) <> ''
      AND LOWER(TRIM(ev.email)) = LOWER(TRIM(us.email))
      AND COALESCE(ev.is_verified, FALSE) IS TRUE
  );

-- -----------------------------------------------------------------------------
-- OPTIONAL — manual repair when 0a0/0a/1b change nothing (no verified_at, no flags)
-- Uncomment and restrict by email or verification_token; then re-run 1b logic by
-- executing the UPDATE in section 1b again or duplicate it below.
-- -----------------------------------------------------------------------------
-- UPDATE email_verifications
-- SET is_verified = TRUE, verified_at = COALESCE(verified_at, NOW())
-- WHERE LOWER(TRIM(email)) = LOWER(TRIM('known-good@example.com'));
--
-- UPDATE user_sessions us
-- SET email_verified = TRUE
-- WHERE us.email IS NOT NULL AND LOWER(TRIM(us.email)) = LOWER(TRIM('known-good@example.com'));

-- -----------------------------------------------------------------------------
-- 2a) Snapshot merged Q25 (must run BEFORE clearing tag_statistics bonus columns)
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE _chon_q25_merged (
  user_session_id UUID PRIMARY KEY,
  ch CHAR(1) NOT NULL
) ON COMMIT DROP;

INSERT INTO _chon_q25_merged (user_session_id, ch)
WITH
q25_from_qr AS (
  SELECT DISTINCT ON (sid)
    sid AS user_session_id,
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
    ) AS ch
  FROM question_responses qr
  CROSS JOIN LATERAL unnest(
    COALESCE(qr.user_session_ids, '{}'::uuid[])
    || CASE
         WHEN qr.user_session_id IS NOT NULL THEN ARRAY[qr.user_session_id]
         ELSE '{}'::uuid[]
       END
  ) AS sid
  WHERE NOT COALESCE(qr.is_text_response, FALSE)
    AND (
      qr.original_question_id = 25
      OR TRIM(qr.original_question_id::text) = '25'
      OR qr.question_id::text = '25'
      OR qr.question_id::text ~ '_25$'
      OR (
        SUBSTRING(qr.question_id::text FROM '([0-9]+)$') IS NOT NULL
        AND (SUBSTRING(qr.question_id::text FROM '([0-9]+)$'))::int = 25
      )
    )
  ORDER BY
    sid,
    qr.updated_at DESC NULLS LAST,
    qr.created_at DESC NULLS LAST,
    qr.id DESC
),
q25_from_ts AS (
  SELECT DISTINCT ON (ts.user_session_id)
    ts.user_session_id,
    CASE COALESCE(NULLIF(TRIM(ts.question_25_bonus_tag), ''), ts.tag_english)
      WHEN 'dedication' THEN 'A'
      WHEN 'emotionalRegulation' THEN 'B'
      WHEN 'selfAwareness' THEN 'C'
      WHEN 'socialIntelligence' THEN 'D'
      WHEN 'coreEndurance' THEN 'E'
      WHEN 'objectivity' THEN 'F'
      ELSE NULL
    END AS ch
  FROM tag_statistics ts
  WHERE ts.question_25_bonus_tag IS NOT NULL
    OR COALESCE(ts.question_25_bonus_applied, FALSE) IS TRUE
  ORDER BY
    ts.user_session_id,
    COALESCE(ts.question_25_bonus_applied, FALSE) DESC,
    CASE WHEN ts.question_25_bonus_tag IS NOT NULL THEN 0 ELSE 1 END,
    ts.id DESC
),
q25_from_cm AS (
  SELECT DISTINCT ON (cm.user_session_id)
    cm.user_session_id,
    UPPER(SUBSTRING(TRIM(cm.question_25_answer), 1, 1)) AS ch
  FROM character_matches cm
  WHERE cm.user_session_id IS NOT NULL
    AND cm.question_25_answer IS NOT NULL
    AND TRIM(cm.question_25_answer) <> ''
  ORDER BY cm.user_session_id, cm.match_rank ASC NULLS LAST, cm.id ASC
),
session_ids AS (
  SELECT user_session_id FROM tag_statistics
  UNION
  SELECT user_session_id FROM character_matches WHERE user_session_id IS NOT NULL
),
merged AS (
  SELECT
    s.user_session_id,
    COALESCE(q.ch, t.ch, c.ch) AS ch
  FROM session_ids s
  LEFT JOIN q25_from_qr q ON q.user_session_id = s.user_session_id
  LEFT JOIN q25_from_ts t ON t.user_session_id = s.user_session_id
  LEFT JOIN q25_from_cm c ON c.user_session_id = s.user_session_id
)
SELECT user_session_id, ch::char(1)
FROM merged
WHERE ch IN ('A', 'B', 'C', 'D', 'E', 'F');

-- -----------------------------------------------------------------------------
-- 2c) question_responses: insert missing unified Q25 (multiple-choice) per session
-- -----------------------------------------------------------------------------
INSERT INTO question_responses (
  user_session_ids,
  questionnaire_type,
  question_id,
  original_question_id,
  question_type,
  response_value,
  is_text_response,
  count
)
SELECT
  ARRAY[us.id]::uuid[],
  us.questionnaire_type,
  COALESCE(us.questionnaire_type::text, 'mother') || '_unified_25',
  25,
  'multiple-choice',
  m.ch::text,
  FALSE,
  1
FROM _chon_q25_merged m
INNER JOIN user_sessions us ON us.id = m.user_session_id
WHERE us.questionnaire_type IS NOT NULL
  AND us.questionnaire_type IN ('mother', 'corporate', 'other', 'both')
  AND NOT EXISTS (
    SELECT 1
    FROM question_responses qr
    WHERE qr.user_session_ids @> ARRAY[m.user_session_id]::uuid[]
      AND qr.original_question_id = 25
      AND COALESCE(qr.is_text_response, FALSE) IS NOT TRUE
  );

-- -----------------------------------------------------------------------------
-- 2b) tag_statistics: clear Q25 bonus columns, then set from snapshot
-- -----------------------------------------------------------------------------
UPDATE tag_statistics
SET
  question_25_bonus_applied = FALSE,
  question_25_bonus_tag = NULL;

UPDATE tag_statistics ts
SET
  question_25_bonus_applied = (ts.tag_english = m.bonus_tag),
  question_25_bonus_tag = CASE
    WHEN ts.tag_english = m.bonus_tag THEN m.bonus_tag
    ELSE NULL
  END
FROM (
  SELECT
    user_session_id,
    CASE ch
      WHEN 'A' THEN 'dedication'
      WHEN 'B' THEN 'emotionalRegulation'
      WHEN 'C' THEN 'selfAwareness'
      WHEN 'D' THEN 'socialIntelligence'
      WHEN 'E' THEN 'coreEndurance'
      WHEN 'F' THEN 'objectivity'
    END AS bonus_tag
  FROM _chon_q25_merged
) m
WHERE ts.user_session_id = m.user_session_id
  AND m.bonus_tag IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3) character_matches.question_25_answer from snapshot (all rows for that session)
-- -----------------------------------------------------------------------------
UPDATE character_matches cm
SET question_25_answer = s.ch::text
FROM _chon_q25_merged s
WHERE cm.user_session_id = s.user_session_id;

-- ROLLBACK;
COMMIT;
