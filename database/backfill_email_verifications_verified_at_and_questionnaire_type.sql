-- =============================================================================
-- Backfill: email_verifications verified_at/is_verified/questionnaire_type
-- =============================================================================
-- Rules:
-- 1) If verified_at is NOT NULL and is_verified is FALSE -> set is_verified TRUE.
-- 1b) If verified_at is NULL but linked/related user_sessions.email_verified is TRUE,
--     set is_verified TRUE (without writing verified_at).
-- 2) If is_verified is FALSE, keep verified_at NULL (cleanup only).
-- 3) questionnaire_type is filled from user_sessions identity selection:
--    a) first by linked user_session_id
--    b) fallback by latest user_session for the same normalized email
--
-- Important:
-- - This script does NOT fabricate verified_at for NULL rows.
-- =============================================================================

BEGIN;

-- 1) verified_at exists => verified.
UPDATE email_verifications
SET is_verified = TRUE
WHERE verified_at IS NOT NULL
  AND COALESCE(is_verified, FALSE) IS NOT TRUE;

-- 1b) Session/email-level verified signal => verified (keep verified_at NULL if NULL).
UPDATE email_verifications ev
SET is_verified = TRUE
FROM user_sessions us
WHERE us.email IS NOT NULL
  AND TRIM(us.email) <> ''
  AND LOWER(TRIM(us.email)) = LOWER(TRIM(ev.email))
  AND COALESCE(us.email_verified, FALSE) IS TRUE
  AND COALESCE(ev.is_verified, FALSE) IS NOT TRUE;

-- 2) Optional cleanup consistency.
UPDATE email_verifications
SET verified_at = NULL
WHERE COALESCE(is_verified, FALSE) IS NOT TRUE
  AND verified_at IS NOT NULL;

-- 3a) questionnaire_type from linked session.
UPDATE email_verifications ev
SET questionnaire_type = us.questionnaire_type
FROM user_sessions us
WHERE ev.user_session_id = us.id
  AND us.questionnaire_type IN ('mother', 'corporate', 'other', 'both')
  AND (
    ev.questionnaire_type IS NULL
    OR ev.questionnaire_type <> us.questionnaire_type
  );

-- 3b) fallback by latest session per email.
UPDATE email_verifications ev
SET questionnaire_type = latest.questionnaire_type
FROM (
  SELECT DISTINCT ON (LOWER(TRIM(email)))
    LOWER(TRIM(email)) AS normalized_email,
    questionnaire_type
  FROM user_sessions
  WHERE email IS NOT NULL
    AND TRIM(email) <> ''
    AND questionnaire_type IN ('mother', 'corporate', 'other', 'both')
  ORDER BY LOWER(TRIM(email)), created_at DESC NULLS LAST, id DESC
) latest
WHERE ev.email IS NOT NULL
  AND TRIM(ev.email) <> ''
  AND LOWER(TRIM(ev.email)) = latest.normalized_email
  AND (
    ev.questionnaire_type IS NULL
    OR ev.questionnaire_type <> latest.questionnaire_type
  );

COMMIT;
