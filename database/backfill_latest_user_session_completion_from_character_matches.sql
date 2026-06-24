-- =============================================================================
-- Backfill latest user_session completion from existing character_matches only
-- =============================================================================
-- Scope: latest linked session from latest email_verifications row.
-- Behavior:
-- - Recomputes character_matches rows from tag_statistics for the latest linked
--   session using the same range math + Q25 tie-break used in backfill scripts.
-- - Inserts all 6 rows (one per character) with:
--   match_rank, in_range_count, out_of_range_diff_sum, final_percentage,
--   question_25_answer.
-- - Then updates user_sessions.questionnaire_completed/character_match/completed_at
--   from the best rank row.
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

DELETE FROM character_matches cm
WHERE cm.user_session_id = (SELECT user_session_id FROM _chon_latest_session);

WITH
scores_raw AS (
  SELECT
    ts.user_session_id,
    MAX(CASE WHEN ts.tag_english = 'selfAwareness' THEN ts.score_percentage END) AS sa,
    MAX(CASE WHEN ts.tag_english = 'dedication' THEN ts.score_percentage END) AS de,
    MAX(CASE WHEN ts.tag_english = 'socialIntelligence' THEN ts.score_percentage END) AS si,
    MAX(CASE WHEN ts.tag_english = 'emotionalRegulation' THEN ts.score_percentage END) AS er,
    MAX(CASE WHEN ts.tag_english = 'objectivity' THEN ts.score_percentage END) AS ob,
    MAX(CASE WHEN ts.tag_english = 'coreEndurance' THEN ts.score_percentage END) AS ce
  FROM tag_statistics ts
  WHERE ts.user_session_id = (SELECT user_session_id FROM _chon_latest_session)
  GROUP BY ts.user_session_id
),
scores AS (
  SELECT
    r.user_session_id,
    r.sa,
    r.de,
    r.si,
    r.er,
    r.ob,
    CASE
      WHEN r.sa IS NOT NULL
        AND r.de IS NOT NULL
        AND r.si IS NOT NULL
        AND r.er IS NOT NULL
        AND r.ob IS NOT NULL
        AND r.ce IS NOT NULL
      THEN
        LEAST(
          100,
          GREATEST(
            0,
            r.ce::numeric + CASE
              WHEN ((r.sa + r.de + r.si + r.er + r.ob)::numeric / 5.0) > 60
              THEN ((r.sa + r.de + r.si + r.er + r.ob)::numeric / 5.0) - 60
              ELSE 0
            END
          )
        )::int
      ELSE r.ce
    END AS ce
  FROM scores_raw r
),
q25 AS (
  SELECT DISTINCT ON (s.user_session_id)
    s.user_session_id,
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
    ) AS q25
  FROM _chon_latest_session s
  JOIN question_responses qr
    ON qr.user_session_ids @> ARRAY[s.user_session_id]::uuid[]
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
  ORDER BY s.user_session_id, qr.updated_at DESC NULLS LAST, qr.created_at DESC, qr.id DESC
),
chars AS (
  SELECT * FROM (VALUES
    ('odin',        80, 100, 20, 60, 30, 60, 40, 60, 60, 80, 40, 60),
    ('wukong',      40, 60, 40, 60, 40, 70, 80, 100, 40, 60, 40, 60),
    ('prometheus',  30, 60, 80, 100, 30, 60, 30, 50, 30, 70, 60, 80),
    ('nuwa',        0, 40, 50, 80, 40, 60, 60, 80, 40, 60, 80, 100),
    ('athena',      60, 80, 0, 40, 50, 70, 40, 60, 70, 100, 40, 60),
    ('venus',       60, 80, 40, 60, 80, 100, 40, 70, 30, 60, 20, 50)
  ) AS v(
    character_id,
    sa_lo, sa_hi, de_lo, de_hi, si_lo, si_hi, er_lo, er_hi, ob_lo, ob_hi, ce_lo, ce_hi
  )
),
metrics AS (
  SELECT
    s.user_session_id,
    c.character_id,
    (CASE WHEN s.sa BETWEEN c.sa_lo AND c.sa_hi THEN 1 ELSE 0 END)
    + (CASE WHEN s.de BETWEEN c.de_lo AND c.de_hi THEN 1 ELSE 0 END)
    + (CASE WHEN s.si BETWEEN c.si_lo AND c.si_hi THEN 1 ELSE 0 END)
    + (CASE WHEN s.er BETWEEN c.er_lo AND c.er_hi THEN 1 ELSE 0 END)
    + (CASE WHEN s.ob BETWEEN c.ob_lo AND c.ob_hi THEN 1 ELSE 0 END)
    + (CASE WHEN s.ce BETWEEN c.ce_lo AND c.ce_hi THEN 1 ELSE 0 END) AS in_range_count,
    (CASE WHEN s.sa < c.sa_lo THEN c.sa_lo - s.sa WHEN s.sa > c.sa_hi THEN s.sa - c.sa_hi ELSE 0 END)
    + (CASE WHEN s.de < c.de_lo THEN c.de_lo - s.de WHEN s.de > c.de_hi THEN s.de - c.de_hi ELSE 0 END)
    + (CASE WHEN s.si < c.si_lo THEN c.si_lo - s.si WHEN s.si > c.si_hi THEN s.si - c.si_hi ELSE 0 END)
    + (CASE WHEN s.er < c.er_lo THEN c.er_lo - s.er WHEN s.er > c.er_hi THEN s.er - c.er_hi ELSE 0 END)
    + (CASE WHEN s.ob < c.ob_lo THEN c.ob_lo - s.ob WHEN s.ob > c.ob_hi THEN s.ob - c.ob_hi ELSE 0 END)
    + (CASE WHEN s.ce < c.ce_lo THEN c.ce_lo - s.ce WHEN s.ce > c.ce_hi THEN s.ce - c.ce_hi ELSE 0 END) AS out_of_range_diff_sum,
    q.q25
  FROM scores s
  CROSS JOIN chars c
  LEFT JOIN q25 q ON q.user_session_id = s.user_session_id
),
with_pct AS (
  SELECT
    m.*,
    ROUND((m.in_range_count::numeric / 6.0) * 100)::int AS final_percentage
  FROM metrics m
),
ranked AS (
  SELECT
    w.user_session_id,
    w.character_id,
    ROW_NUMBER() OVER (
      PARTITION BY w.user_session_id
      ORDER BY
        w.in_range_count DESC,
        w.out_of_range_diff_sum ASC,
        CASE w.q25
          WHEN 'A' THEN CASE WHEN w.character_id = 'prometheus' THEN 0 ELSE 1 END
          WHEN 'B' THEN CASE WHEN w.character_id = 'wukong' THEN 0 ELSE 1 END
          WHEN 'C' THEN CASE WHEN w.character_id = 'odin' THEN 0 ELSE 1 END
          WHEN 'D' THEN CASE WHEN w.character_id = 'venus' THEN 0 ELSE 1 END
          WHEN 'E' THEN CASE WHEN w.character_id = 'nuwa' THEN 0 ELSE 1 END
          WHEN 'F' THEN CASE WHEN w.character_id = 'athena' THEN 0 ELSE 1 END
          ELSE 0
        END,
        w.character_id
    ) AS match_rank,
    w.in_range_count,
    w.out_of_range_diff_sum,
    w.final_percentage,
    w.q25
  FROM with_pct w
)
INSERT INTO character_matches (
  user_session_id,
  character_id,
  match_rank,
  in_range_count,
  out_of_range_diff_sum,
  final_percentage,
  question_25_answer
)
SELECT
  r.user_session_id,
  r.character_id,
  r.match_rank,
  r.in_range_count,
  r.out_of_range_diff_sum,
  r.final_percentage,
  r.q25
FROM ranked r;

UPDATE user_sessions us
SET
  questionnaire_completed = TRUE,
  character_match = best.character_id,
  completed_at = COALESCE(us.completed_at, NOW())
FROM (
  SELECT DISTINCT ON (cm.user_session_id)
    cm.user_session_id,
    cm.character_id
  FROM character_matches cm
  WHERE cm.user_session_id = (SELECT user_session_id FROM _chon_latest_session)
  ORDER BY cm.user_session_id, cm.match_rank ASC NULLS LAST, cm.id ASC
) best
WHERE us.id = best.user_session_id;

COMMIT;
