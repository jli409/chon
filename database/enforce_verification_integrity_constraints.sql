-- =============================================================================
-- Enforce verification integrity at DB layer
-- =============================================================================
-- Tables:
--   - email_verifications
--   - user_sessions
--
-- Goals:
-- 1) email_verifications:
--    - if is_verified = TRUE, verified_at must be present
--    - if is_verified = FALSE, verified_at must be NULL
-- 2) user_sessions:
--    - email_verified cannot be TRUE when email is empty
-- 3) Add BEFORE triggers to normalize incoming writes so future inserts/updates
--    remain consistent even if API logic regresses.
--
-- NOTE:
-- - Constraints are added as NOT VALID so existing legacy rows do not block
--   deployment. New/updated rows are still enforced immediately.
-- - After backfill cleanup, run VALIDATE CONSTRAINT statements.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Trigger function: normalize email_verifications pair
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION chon_normalize_email_verification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.is_verified, FALSE) IS TRUE THEN
    IF NEW.verified_at IS NULL THEN
      NEW.verified_at := NOW();
    END IF;
  ELSE
    NEW.verified_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chon_normalize_email_verification ON email_verifications;
CREATE TRIGGER trg_chon_normalize_email_verification
BEFORE INSERT OR UPDATE ON email_verifications
FOR EACH ROW
EXECUTE FUNCTION chon_normalize_email_verification();

-- -----------------------------------------------------------------------------
-- Trigger function: prevent verified sessions without email
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION chon_normalize_user_session_email_verified()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS NULL OR BTRIM(NEW.email) = '' THEN
    NEW.email_verified := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chon_normalize_user_session_email_verified ON user_sessions;
CREATE TRIGGER trg_chon_normalize_user_session_email_verified
BEFORE INSERT OR UPDATE ON user_sessions
FOR EACH ROW
EXECUTE FUNCTION chon_normalize_user_session_email_verified();

-- -----------------------------------------------------------------------------
-- CHECK constraints (future-safe with NOT VALID)
-- -----------------------------------------------------------------------------
ALTER TABLE email_verifications
  DROP CONSTRAINT IF EXISTS chk_email_verifications_verified_pair;
ALTER TABLE email_verifications
  ADD CONSTRAINT chk_email_verifications_verified_pair
  CHECK (
    (
      COALESCE(is_verified, FALSE) IS TRUE
      AND verified_at IS NOT NULL
    )
    OR
    (
      COALESCE(is_verified, FALSE) IS NOT TRUE
      AND verified_at IS NULL
    )
  )
  NOT VALID;

ALTER TABLE user_sessions
  DROP CONSTRAINT IF EXISTS chk_user_sessions_verified_requires_email;
ALTER TABLE user_sessions
  ADD CONSTRAINT chk_user_sessions_verified_requires_email
  CHECK (
    NOT (
      COALESCE(email_verified, FALSE) IS TRUE
      AND (email IS NULL OR BTRIM(email) = '')
    )
  )
  NOT VALID;

COMMIT;

-- -----------------------------------------------------------------------------
-- Run these after legacy cleanup to fully validate historical rows:
-- -----------------------------------------------------------------------------
-- ALTER TABLE email_verifications VALIDATE CONSTRAINT chk_email_verifications_verified_pair;
-- ALTER TABLE user_sessions VALIDATE CONSTRAINT chk_user_sessions_verified_requires_email;
