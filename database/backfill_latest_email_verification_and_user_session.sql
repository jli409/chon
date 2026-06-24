-- =============================================================================
-- Backfill latest email_verifications + linked user_sessions only
-- =============================================================================
-- Scope: latest row in email_verifications, and latest linked user_session.
-- Rules:
-- - Do NOT fabricate verified_at.
-- - is_verified is derived from verified_at OR existing user_sessions.email_verified.
-- - questionnaire_type is copied from linked user_session when available.
-- - user_sessions.email_verified is synced from email_verifications truth.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _chon_latest_target AS
WITH latest_ev AS (
  SELECT *
  FROM email_verifications
  ORDER BY created_at DESC NULLS LAST, id DESC
  LIMIT 1
),
linked_session AS (
  SELECT us.id, us.questionnaire_type, us.email
  FROM user_sessions us
  JOIN latest_ev ev ON (
    (
      ev.session_token IS NOT NULL
      AND ev.session_token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND ev.session_token::uuid = us.id
    )
    OR (
      ev.email IS NOT NULL
      AND us.email IS NOT NULL
      AND LOWER(TRIM(ev.email)) = LOWER(TRIM(us.email))
    )
  )
  ORDER BY us.created_at DESC NULLS LAST, us.id DESC
  LIMIT 1
)
SELECT
  ev.id AS email_verification_id,
  ev.email,
  ls.id AS user_session_id,
  ls.questionnaire_type
FROM latest_ev ev
LEFT JOIN linked_session ls ON TRUE;

-- Keep verified_at exactly as-is (no fabrication).
-- Set is_verified true when verified_at exists OR linked session already true.
UPDATE email_verifications ev
SET is_verified = (
  ev.verified_at IS NOT NULL
  OR COALESCE((
    SELECT us.email_verified
    FROM user_sessions us
    WHERE us.id = (SELECT user_session_id FROM _chon_latest_target)
  ), FALSE)
)
WHERE ev.id = (SELECT email_verification_id FROM _chon_latest_target);

-- Fill questionnaire_type from linked session when missing.
UPDATE email_verifications ev
SET questionnaire_type = t.questionnaire_type
FROM _chon_latest_target t
WHERE ev.id = t.email_verification_id
  AND t.questionnaire_type IN ('mother', 'corporate', 'other', 'both')
  AND (ev.questionnaire_type IS NULL OR ev.questionnaire_type <> t.questionnaire_type);

-- Sync user_sessions.email_verified from latest ev truth.
UPDATE user_sessions us
SET email_verified = EXISTS (
  SELECT 1
  FROM email_verifications ev
  WHERE ev.id = (SELECT email_verification_id FROM _chon_latest_target)
    AND (COALESCE(ev.is_verified, FALSE) IS TRUE OR ev.verified_at IS NOT NULL)
)
WHERE us.id = (SELECT user_session_id FROM _chon_latest_target);

COMMIT;
