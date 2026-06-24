-- =============================================================================
-- Backfill: email_verifications click state + identity-derived questionnaire_type
-- =============================================================================
-- Purpose:
-- 1) Make is_verified strictly reflect click state represented by verified_at:
--      is_verified = (verified_at IS NOT NULL)
-- 2) Keep verified_at consistent with is_verified:
--      - if is_verified is FALSE, verified_at is NULL
-- 3) Fill questionnaire_type from identity selection in user_sessions.
--
-- Important:
-- - If both is_verified = FALSE and verified_at IS NULL, SQL cannot infer whether
--   user actually clicked before logging was fixed. You must repair those rows
--   manually (example section at bottom).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Strict rule: if verified_at exists, mark verified.
--    Do NOT auto-create verified_at for rows that are currently NULL.
-- -----------------------------------------------------------------------------
UPDATE email_verifications
SET is_verified = TRUE
WHERE verified_at IS NOT NULL
  AND COALESCE(is_verified, FALSE) IS NOT TRUE;

-- -----------------------------------------------------------------------------
-- 2) Optional cleanup: if a row is not verified, verified_at must be NULL
-- -----------------------------------------------------------------------------
UPDATE email_verifications
SET verified_at = NULL
WHERE COALESCE(is_verified, FALSE) IS NOT TRUE
  AND verified_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3) questionnaire_type from linked user_session first
-- -----------------------------------------------------------------------------
UPDATE email_verifications ev
SET questionnaire_type = us.questionnaire_type
FROM user_sessions us
WHERE ev.user_session_id = us.id
  AND us.questionnaire_type IN ('mother', 'corporate', 'other', 'both')
  AND (
    ev.questionnaire_type IS NULL
    OR ev.questionnaire_type <> us.questionnaire_type
  );

-- -----------------------------------------------------------------------------
-- 4) fallback questionnaire_type by latest user_session per normalized email
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
-- Optional manual repair for known clicked users not reflected in DB:
-- Uncomment and edit email/token, then re-run sections 1-4.
-- -----------------------------------------------------------------------------
-- UPDATE email_verifications
-- SET verified_at = COALESCE(verified_at, NOW())
-- WHERE LOWER(TRIM(email)) = LOWER(TRIM('known-clicked@example.com'));

COMMIT;
