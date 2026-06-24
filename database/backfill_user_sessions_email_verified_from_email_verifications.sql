-- =============================================================================
-- Backfill: user_sessions.email_verified from email_verifications
-- =============================================================================
-- Fixes:
-- 1) Any session with no email cannot be verified.
-- 2) Sessions linked by token/email to verified email_verifications rows are TRUE.
-- 3) All other sessions are FALSE.
--
-- Run after email_verifications backfill for best results.
-- =============================================================================

BEGIN;

-- 1) No email -> must be false.
UPDATE user_sessions
SET email_verified = FALSE
WHERE (email IS NULL OR TRIM(email) = '')
  AND COALESCE(email_verified, FALSE) IS TRUE;

-- 2) Verified email in email_verifications -> true.
UPDATE user_sessions us
SET email_verified = TRUE
WHERE EXISTS (
    SELECT 1
    FROM email_verifications ev
    WHERE (
        -- strongest link: verification row session_token == session id
        ev.session_token = us.id::text
        OR (
          ev.email IS NOT NULL
          AND TRIM(ev.email) <> ''
          AND us.email IS NOT NULL
          AND TRIM(us.email) <> ''
          AND LOWER(TRIM(ev.email)) = LOWER(TRIM(us.email))
        )
      )
      AND (
        COALESCE(ev.is_verified, FALSE) IS TRUE
        OR ev.verified_at IS NOT NULL
      )
  );

-- 3) Non-verified emails -> false.
UPDATE user_sessions us
SET email_verified = FALSE
WHERE NOT EXISTS (
    SELECT 1
    FROM email_verifications ev
    WHERE (
        ev.session_token = us.id::text
        OR (
          ev.email IS NOT NULL
          AND TRIM(ev.email) <> ''
          AND us.email IS NOT NULL
          AND TRIM(us.email) <> ''
          AND LOWER(TRIM(ev.email)) = LOWER(TRIM(us.email))
        )
      )
      AND (
        COALESCE(ev.is_verified, FALSE) IS TRUE
        OR ev.verified_at IS NOT NULL
      )
  );

COMMIT;
