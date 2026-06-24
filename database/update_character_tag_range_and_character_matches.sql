-- =============================================================================
-- Update character_tag_range, then recompute character_matches from it
-- =============================================================================
--
-- Assumed range table shape:
--   character_tag_range(character_id, tag_english, min_score, max_score)
--
-- If your table uses different names, update only the INSERT target below
-- and the range_values CTE column aliases in the recompute query.
--
-- Safe run flow:
--   1) Run PREVIEW.
--   2) Run BACKFILL with ROLLBACK at the end.
--   3) Change ROLLBACK to COMMIT and run again after review.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PREVIEW: sessions that will have character_matches rebuilt
-- -----------------------------------------------------------------------------
WITH eligible_sessions AS (
  SELECT user_session_id
  FROM tag_statistics
  WHERE tag_english IN (
    'selfAwareness',
    'dedication',
    'socialIntelligence',
    'emotionalRegulation',
    'objectivity',
    'coreEndurance'
  )
  GROUP BY user_session_id
  HAVING COUNT(DISTINCT tag_english) = 6
),
match_counts AS (
  SELECT user_session_id, COUNT(*)::int AS existing_character_match_rows
  FROM character_matches
  GROUP BY user_session_id
)
SELECT
  es.user_session_id,
  COALESCE(mc.existing_character_match_rows, 0) AS existing_character_match_rows
FROM eligible_sessions es
LEFT JOIN match_counts mc ON mc.user_session_id = es.user_session_id
ORDER BY es.user_session_id;

-- -----------------------------------------------------------------------------
-- BACKFILL
-- -----------------------------------------------------------------------------
BEGIN;

-- 1) Upsert current character ranges.
INSERT INTO character_tag_range (
  character_id,
  tag_english,
  min_score,
  max_score
)
VALUES
  ('odin',       'selfAwareness',       80, 100),
  ('odin',       'dedication',          20, 60),
  ('odin',       'socialIntelligence',  30, 60),
  ('odin',       'emotionalRegulation', 40, 60),
  ('odin',       'objectivity',         60, 80),
  ('odin',       'coreEndurance',       40, 60),

  ('wukong',     'selfAwareness',       40, 60),
  ('wukong',     'dedication',          40, 60),
  ('wukong',     'socialIntelligence',  40, 70),
  ('wukong',     'emotionalRegulation', 80, 100),
  ('wukong',     'objectivity',         40, 60),
  ('wukong',     'coreEndurance',       40, 60),

  ('prometheus', 'selfAwareness',       30, 60),
  ('prometheus', 'dedication',          80, 100),
  ('prometheus', 'socialIntelligence',  30, 60),
  ('prometheus', 'emotionalRegulation', 30, 50),
  ('prometheus', 'objectivity',         30, 70),
  ('prometheus', 'coreEndurance',       60, 80),

  ('nuwa',       'selfAwareness',       0, 40),
  ('nuwa',       'dedication',          50, 80),
  ('nuwa',       'socialIntelligence',  40, 60),
  ('nuwa',       'emotionalRegulation', 60, 80),
  ('nuwa',       'objectivity',         40, 60),
  ('nuwa',       'coreEndurance',       80, 100),

  ('athena',     'selfAwareness',       60, 80),
  ('athena',     'dedication',          0, 40),
  ('athena',     'socialIntelligence',  50, 70),
  ('athena',     'emotionalRegulation', 40, 60),
  ('athena',     'objectivity',         70, 100),
  ('athena',     'coreEndurance',       40, 60),

  ('venus',      'selfAwareness',       60, 80),
  ('venus',      'dedication',          40, 60),
  ('venus',      'socialIntelligence',  80, 100),
  ('venus',      'emotionalRegulation', 40, 70),
  ('venus',      'objectivity',         30, 60),
  ('venus',      'coreEndurance',       20, 50)
ON CONFLICT (character_id, tag_english) DO UPDATE
SET
  min_score = EXCLUDED.min_score,
  max_score = EXCLUDED.max_score;

-- Optional sanity check: should return 6 characters, each with 6 tag ranges.
SELECT character_id, COUNT(*)::int AS tag_range_rows
FROM character_tag_range
GROUP BY character_id
ORDER BY character_id;

-- 2) Recompute all character_matches for sessions with all six tag_statistics.
CREATE TEMP TABLE _chon_sessions_recompute_cm AS
SELECT user_session_id
FROM tag_statistics
WHERE tag_english IN (
  'selfAwareness',
  'dedication',
  'socialIntelligence',
  'emotionalRegulation',
  'objectivity',
  'coreEndurance'
)
GROUP BY user_session_id
HAVING COUNT(DISTINCT tag_english) = 6;

DELETE FROM character_matches cm
USING _chon_sessions_recompute_cm s
WHERE cm.user_session_id = s.user_session_id;

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
  INNER JOIN _chon_sessions_recompute_cm s ON s.user_session_id = ts.user_session_id
  GROUP BY ts.user_session_id
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
  FROM question_responses qr
  INNER JOIN _chon_sessions_recompute_cm s ON qr.user_session_ids @> ARRAY[s.user_session_id]::uuid[]
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
scores_with_bonus AS (
  SELECT
    r.user_session_id,
    LEAST(100, r.sa + CASE WHEN q.q25 = 'C' THEN 10 ELSE 0 END)::int AS sa,
    LEAST(100, r.de + CASE WHEN q.q25 = 'A' THEN 10 ELSE 0 END)::int AS de,
    LEAST(100, r.si + CASE WHEN q.q25 = 'D' THEN 10 ELSE 0 END)::int AS si,
    LEAST(100, r.er + CASE WHEN q.q25 = 'B' THEN 10 ELSE 0 END)::int AS er,
    LEAST(100, r.ob + CASE WHEN q.q25 = 'F' THEN 10 ELSE 0 END)::int AS ob,
    LEAST(100, r.ce + CASE WHEN q.q25 = 'E' THEN 10 ELSE 0 END)::int AS ce,
    q.q25
  FROM scores_raw r
  LEFT JOIN q25 q ON q.user_session_id = r.user_session_id
),
scores AS (
  SELECT
    b.user_session_id,
    b.sa,
    b.de,
    b.si,
    b.er,
    b.ob,
    LEAST(
      100,
      GREATEST(
        0,
        b.ce::numeric + CASE
          WHEN ((b.sa + b.de + b.si + b.er + b.ob)::numeric / 5.0) > 60
          THEN ((b.sa + b.de + b.si + b.er + b.ob)::numeric / 5.0) - 60
          ELSE 0
        END
      )
    )::int AS ce,
    b.q25
  FROM scores_with_bonus b
),
range_values AS (
  SELECT
    character_id,
    MAX(CASE WHEN tag_english = 'selfAwareness' THEN min_score END) AS sa_lo,
    MAX(CASE WHEN tag_english = 'selfAwareness' THEN max_score END) AS sa_hi,
    MAX(CASE WHEN tag_english = 'dedication' THEN min_score END) AS de_lo,
    MAX(CASE WHEN tag_english = 'dedication' THEN max_score END) AS de_hi,
    MAX(CASE WHEN tag_english = 'socialIntelligence' THEN min_score END) AS si_lo,
    MAX(CASE WHEN tag_english = 'socialIntelligence' THEN max_score END) AS si_hi,
    MAX(CASE WHEN tag_english = 'emotionalRegulation' THEN min_score END) AS er_lo,
    MAX(CASE WHEN tag_english = 'emotionalRegulation' THEN max_score END) AS er_hi,
    MAX(CASE WHEN tag_english = 'objectivity' THEN min_score END) AS ob_lo,
    MAX(CASE WHEN tag_english = 'objectivity' THEN max_score END) AS ob_hi,
    MAX(CASE WHEN tag_english = 'coreEndurance' THEN min_score END) AS ce_lo,
    MAX(CASE WHEN tag_english = 'coreEndurance' THEN max_score END) AS ce_hi
  FROM character_tag_range
  WHERE tag_english IN (
    'selfAwareness',
    'dedication',
    'socialIntelligence',
    'emotionalRegulation',
    'objectivity',
    'coreEndurance'
  )
  GROUP BY character_id
  HAVING COUNT(DISTINCT tag_english) = 6
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
    s.q25
  FROM scores s
  CROSS JOIN range_values c
),
ranked AS (
  SELECT
    m.user_session_id,
    m.character_id,
    m.in_range_count,
    m.out_of_range_diff_sum,
    ROUND((m.in_range_count::numeric / 6.0) * 100)::int AS final_percentage,
    m.q25,
    ROW_NUMBER() OVER (
      PARTITION BY m.user_session_id
      ORDER BY
        m.in_range_count DESC,
        m.out_of_range_diff_sum ASC,
        CASE m.q25
          WHEN 'A' THEN CASE WHEN m.character_id = 'prometheus' THEN 0 ELSE 1 END
          WHEN 'B' THEN CASE WHEN m.character_id = 'wukong' THEN 0 ELSE 1 END
          WHEN 'C' THEN CASE WHEN m.character_id = 'odin' THEN 0 ELSE 1 END
          WHEN 'D' THEN CASE WHEN m.character_id = 'venus' THEN 0 ELSE 1 END
          WHEN 'E' THEN CASE WHEN m.character_id = 'nuwa' THEN 0 ELSE 1 END
          WHEN 'F' THEN CASE WHEN m.character_id = 'athena' THEN 0 ELSE 1 END
          ELSE 0
        END,
        m.character_id
    ) AS match_rank
  FROM metrics m
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
  user_session_id,
  character_id,
  match_rank,
  in_range_count,
  out_of_range_diff_sum,
  final_percentage,
  q25
FROM ranked;

UPDATE user_sessions us
SET
  character_match = cm.character_id,
  questionnaire_completed = TRUE,
  completed_at = COALESCE(us.completed_at, NOW())
FROM character_matches cm
INNER JOIN _chon_sessions_recompute_cm s ON s.user_session_id = cm.user_session_id
WHERE us.id = cm.user_session_id
  AND cm.match_rank = 1;

DROP TABLE _chon_sessions_recompute_cm;

-- Review affected rows first. Change to COMMIT when ready.
ROLLBACK;
