-- =============================================================================
-- Undo likely effects from old regression bundle (latest target only)
-- =============================================================================
-- This script is conservative and only targets the latest email_verifications row
-- and its linked user_session.
--
-- What it undoes:
-- 1) Re-align email_verifications.is_verified to verified_at truth.
-- 2) Remove zero-filled tag_statistics rows that were likely synthetic
--    (only when no supporting tag_scores exist for that tag/session).
-- 3) Reset user_sessions completion flags if there are no character_matches rows.
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
  SELECT us.id
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
SELECT ev.id AS email_verification_id, ls.id AS user_session_id
FROM latest_ev ev
LEFT JOIN linked_session ls ON TRUE;

-- 1) Undo forced is_verified by using verified_at as source of truth.
UPDATE email_verifications ev
SET is_verified = (ev.verified_at IS NOT NULL)
WHERE ev.id = (SELECT email_verification_id FROM _chon_latest_target);

-- 2) Remove likely synthetic zero rows in tag_statistics for target session.
DELETE FROM tag_statistics ts
WHERE ts.user_session_id = (SELECT user_session_id FROM _chon_latest_target)
  AND COALESCE(ts.user_score, 0) = 0
  AND COALESCE(ts.total_possible_score, 0) = 0
  AND COALESCE(ts.score_percentage, 0) = 0
  AND COALESCE(ts.answered_questions, 0) = 0
  AND NOT EXISTS (
    SELECT 1
    FROM tag_scores sc
    WHERE sc.user_session_id = ts.user_session_id
      AND sc.tag_english = ts.tag_english
  );

-- 3) Reset completion fields only if session has no character_matches rows.
UPDATE user_sessions us
SET
  questionnaire_completed = FALSE,
  character_match = NULL,
  completed_at = NULL
WHERE us.id = (SELECT user_session_id FROM _chon_latest_target)
  AND NOT EXISTS (
    SELECT 1
    FROM character_matches cm
    WHERE cm.user_session_id = us.id
  );

COMMIT;
