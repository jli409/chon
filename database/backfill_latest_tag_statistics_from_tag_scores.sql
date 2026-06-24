-- =============================================================================
-- Backfill latest session tag_statistics from tag_scores only
-- =============================================================================
-- Scope: latest linked session from latest email_verifications row.
-- Behavior:
-- - Inserts ONLY missing tag_statistics rows for the 6 standard tags.
-- - Uses aggregated tag_scores for values.
-- - If no tag_scores for a missing tag, leaves zeros for that tag row.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _chon_latest_session AS
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
SELECT id AS user_session_id
FROM linked_session;

WITH all_tags AS (
  SELECT unnest(ARRAY[
    'selfAwareness',
    'dedication',
    'socialIntelligence',
    'emotionalRegulation',
    'objectivity',
    'coreEndurance'
  ])::text AS tag_english
),
missing AS (
  SELECT s.user_session_id, t.tag_english
  FROM _chon_latest_session s
  CROSS JOIN all_tags t
  LEFT JOIN tag_statistics ts
    ON ts.user_session_id = s.user_session_id
   AND ts.tag_english = t.tag_english
  WHERE ts.id IS NULL
),
agg AS (
  SELECT
    sc.user_session_id,
    sc.tag_english,
    SUM(sc.score)::int AS user_score,
    (COUNT(*) * 100)::int AS total_possible_score,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((SUM(sc.score)::numeric / (COUNT(*) * 100)::numeric) * 100)::int
    END AS score_percentage,
    COUNT(*)::int AS answered_questions
  FROM tag_scores sc
  WHERE sc.user_session_id = (SELECT user_session_id FROM _chon_latest_session)
  GROUP BY sc.user_session_id, sc.tag_english
)
INSERT INTO tag_statistics (
  user_session_id,
  tag_english,
  user_score,
  total_possible_score,
  score_percentage,
  answered_questions,
  question_25_bonus_applied,
  question_25_bonus_tag
)
SELECT
  m.user_session_id,
  m.tag_english,
  COALESCE(a.user_score, 0),
  COALESCE(a.total_possible_score, 0),
  COALESCE(a.score_percentage, 0),
  COALESCE(a.answered_questions, 0),
  FALSE,
  NULL
FROM missing m
LEFT JOIN agg a
  ON a.user_session_id = m.user_session_id
 AND a.tag_english = m.tag_english;

COMMIT;
