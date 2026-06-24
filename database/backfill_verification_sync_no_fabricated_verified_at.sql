-- =============================================================================
-- Backfill: verification sync (no fabricated verified_at)
-- =============================================================================
-- This script intentionally DOES NOT create guessed verified_at timestamps.
-- It only:
--   1) sets email_verifications.is_verified = TRUE where verified_at exists
--   2) aligns email_verifications.questionnaire_type from user_sessions
--   3) syncs user_sessions.email_verified from email_verifications
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) verified_at present => verified TRUE
-- -----------------------------------------------------------------------------
UPDATE email_verifications
SET is_verified = TRUE
WHERE verified_at IS NOT NULL
  AND COALESCE(is_verified, FALSE) IS NOT TRUE;

-- -----------------------------------------------------------------------------
-- 2a) questionnaire_type from linked user_session via session_token -> user_sessions.id
-- -----------------------------------------------------------------------------
UPDATE email_verifications ev
SET questionnaire_type = us.questionnaire_type
FROM user_sessions us
WHERE ev.session_token IS NOT NULL
  AND ev.session_token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND ev.session_token::uuid = us.id
  AND us.questionnaire_type IN ('mother', 'corporate', 'other', 'both')
  AND (
    ev.questionnaire_type IS NULL
    OR ev.questionnaire_type <> us.questionnaire_type
  );

-- -----------------------------------------------------------------------------
-- 2b) questionnaire_type fallback from latest user_session by email
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 3a) user_sessions with no email cannot be verified
-- -----------------------------------------------------------------------------
UPDATE user_sessions
SET email_verified = FALSE
WHERE COALESCE(email_verified, FALSE) IS TRUE
  AND (email IS NULL OR TRIM(email) = '');

-- -----------------------------------------------------------------------------
-- 3b) set user_sessions.email_verified based on email_verifications
-- -----------------------------------------------------------------------------
UPDATE user_sessions us
SET email_verified = EXISTS (
  SELECT 1
  FROM email_verifications ev
  WHERE ev.email IS NOT NULL
    AND TRIM(ev.email) <> ''
    AND us.email IS NOT NULL
    AND TRIM(us.email) <> ''
    AND LOWER(TRIM(ev.email)) = LOWER(TRIM(us.email))
    AND COALESCE(ev.is_verified, FALSE) IS TRUE
);

COMMIT;
