-- =============================================================================
-- Backfill tag_statistics + character_matches for one session
-- =============================================================================
--
-- Target session:
--   48e523f9-ded7-4f58-a1e9-46a9164c1eef
--
-- Scope:
--   * Rebuilds tag_statistics from existing tag_scores.
--   * Re-resolves Q25 from question_responses and reapplies the +10 bonus.
--   * Rebuilds all six character_matches rows from tag_statistics.
--   * Updates user_sessions.character_match from rank 1.
--
-- To dry-run, replace COMMIT with ROLLBACK.
-- =============================================================================

BEGIN;

DELETE FROM tag_statistics
WHERE user_session_id = '48e523f9-ded7-4f58-a1e9-46a9164c1eef'::uuid;

WITH
agg AS (
  SELECT
    sc.user_session_id,
    sc.tag_english,
    SUM(sc.score)::int AS user_score,
    (COUNT(*) * 100)::int AS total_possible_score,
    ROUND((SUM(sc.score)::numeric / (COUNT(*) * 100)::numeric) * 100)::int AS score_percentage,
    COUNT(*)::int AS answered_questions
  FROM tag_scores sc
  WHERE sc.user_session_id = '48e523f9-ded7-4f58-a1e9-46a9164c1eef'::uuid
  GROUP BY sc.user_session_id, sc.tag_english
),
canon(tag_english) AS (
  SELECT unnest(ARRAY[
    'selfAwareness',
    'dedication',
    'socialIntelligence',
    'emotionalRegulation',
    'objectivity',
    'coreEndurance'
  ]::text[])
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
  '48e523f9-ded7-4f58-a1e9-46a9164c1eef'::uuid,
  c.tag_english,
  COALESCE(a.user_score, 0),
  COALESCE(a.total_possible_score, 0),
  COALESCE(a.score_percentage, 0),
  COALESCE(a.answered_questions, 0),
  FALSE,
  NULL
FROM canon c
LEFT JOIN agg a ON a.tag_english = c.tag_english;

WITH
q25_candidates AS (
  SELECT
    UPPER(SUBSTRING(TRIM(COALESCE(NULLIF(TRIM(COALESCE(qr.response_value, '')), ''), NULLIF(TRIM(COALESCE(qr.response_text, '')), ''))), 1, 1)) AS q25,
    qr.updated_at,
    qr.created_at,
    qr.id,
    CASE
      WHEN us.questionnaire_type IS NOT NULL AND qr.questionnaire_type = us.questionnaire_type THEN 0
      ELSE 1
    END AS questionnaire_rank
  FROM question_responses qr
  LEFT JOIN user_sessions us ON us.id = '48e523f9-ded7-4f58-a1e9-46a9164c1eef'::uuid
  WHERE qr.user_session_ids @> ARRAY['48e523f9-ded7-4f58-a1e9-46a9164c1eef'::uuid]
    AND qr.question_type = 'multiple-choice'
    AND NOT COALESCE(qr.is_text_response, FALSE)
    AND (
      qr.original_question_id = 25
      OR btrim(qr.original_question_id::text) = '25'
      OR qr.question_id::text = '25'
      OR qr.question_id::text ~ '_25$'
      OR qr.question_id::text ~* '_unified_25$'
      OR lower(btrim(qr.question_id::text)) IN ('mother_33', 'corporate_33', 'other_29', 'both_45')
      OR (qr.questionnaire_type = 'mother' AND qr.original_question_id = 33)
      OR (qr.questionnaire_type = 'corporate' AND qr.original_question_id = 33)
      OR (qr.questionnaire_type = 'other' AND qr.original_question_id = 29)
      OR (qr.questionnaire_type = 'both' AND qr.original_question_id = 45)
    )
),
q25_latest AS (
  SELECT q25
  FROM q25_candidates
  WHERE q25 IN ('A', 'B', 'C', 'D', 'E', 'F')
  ORDER BY questionnaire_rank ASC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
  LIMIT 1
),
resolved AS (
  SELECT
    q25,
    CASE q25
      WHEN 'A' THEN 'dedication'
      WHEN 'B' THEN 'emotionalRegulation'
      WHEN 'C' THEN 'selfAwareness'
      WHEN 'D' THEN 'socialIntelligence'
      WHEN 'E' THEN 'coreEndurance'
      WHEN 'F' THEN 'objectivity'
    END AS bonus_tag
  FROM q25_latest
)
UPDATE tag_statistics ts
SET
  question_25_bonus_applied = TRUE,
  question_25_bonus_tag = r.bonus_tag,
  score_percentage = LEAST(100, ts.score_percentage + 10),
  user_score = CASE
    WHEN ts.total_possible_score > 0
    THEN ROUND((LEAST(100, ts.score_percentage + 10)::numeric / 100.0) * ts.total_possible_score)::int
    ELSE ts.user_score
  END
FROM resolved r
WHERE ts.user_session_id = '48e523f9-ded7-4f58-a1e9-46a9164c1eef'::uuid
  AND ts.tag_english = r.bonus_tag;

DELETE FROM character_matches
WHERE user_session_id = '48e523f9-ded7-4f58-a1e9-46a9164c1eef'::uuid;

WITH
scores_raw AS (
  SELECT
    ts.user_session_id,
    MAX(CASE WHEN ts.tag_english = 'selfAwareness' THEN ts.score_percentage END) AS sa,
    MAX(CASE WHEN ts.tag_english = 'dedication' THEN ts.score_percentage END) AS de,
    MAX(CASE WHEN ts.tag_english = 'socialIntelligence' THEN ts.score_percentage END) AS si,
    MAX(CASE WHEN ts.tag_english = 'emotionalRegulation' THEN ts.score_percentage END) AS er,
    MAX(CASE WHEN ts.tag_english = 'objectivity' THEN ts.score_percentage END) AS ob,
    MAX(CASE WHEN ts.tag_english = 'coreEndurance' THEN ts.score_percentage END) AS ce,
    MAX(CASE ts.question_25_bonus_tag WHEN 'dedication' THEN 'A' WHEN 'emotionalRegulation' THEN 'B' WHEN 'selfAwareness' THEN 'C' WHEN 'socialIntelligence' THEN 'D' WHEN 'coreEndurance' THEN 'E' WHEN 'objectivity' THEN 'F' END) AS q25
  FROM tag_statistics ts
  WHERE ts.user_session_id = '48e523f9-ded7-4f58-a1e9-46a9164c1eef'::uuid
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
    r.q25,
    CASE
      WHEN r.sa IS NOT NULL AND r.de IS NOT NULL AND r.si IS NOT NULL AND r.er IS NOT NULL AND r.ob IS NOT NULL AND r.ce IS NOT NULL
      THEN LEAST(100, GREATEST(0, r.ce::numeric + CASE WHEN ((r.sa + r.de + r.si + r.er + r.ob)::numeric / 5.0) > 60 THEN ((r.sa + r.de + r.si + r.er + r.ob)::numeric / 5.0) - 60 ELSE 0 END))::int
      ELSE r.ce
    END AS ce
  FROM scores_raw r
),
chars AS (
  SELECT *
  FROM (VALUES
    ('odin',        80, 100, 20, 60, 30, 60, 40, 60, 60, 80, 40, 60),
    ('wukong',      40, 60, 40, 60, 40, 70, 80, 100, 40, 60, 40, 60),
    ('prometheus',  30, 60, 80, 100, 30, 60, 30, 50, 30, 70, 60, 80),
    ('nuwa', 0, 40, 50, 80, 40, 60, 60, 80, 40, 60, 80, 100),
    ('athena', 60, 80, 0, 40, 50, 70, 40, 60, 70, 100, 40, 60),
    ('venus', 60, 80, 40, 60, 80, 100, 40, 70, 30, 60, 20, 50)
  ) AS v(character_id, sa_lo, sa_hi, de_lo, de_hi, si_lo, si_hi, er_lo, er_hi, ob_lo, ob_hi, ce_lo, ce_hi)
),
metrics AS (
  SELECT
    s.user_session_id,
    c.character_id,
    s.q25,
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
    + (CASE WHEN s.ce < c.ce_lo THEN c.ce_lo - s.ce WHEN s.ce > c.ce_hi THEN s.ce - c.ce_hi ELSE 0 END) AS out_of_range_diff_sum
  FROM scores s
  CROSS JOIN chars c
),
ranked AS (
  SELECT
    m.*,
    ROUND((m.in_range_count::numeric / 6.0) * 100)::int AS final_percentage,
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
WHERE cm.user_session_id = '48e523f9-ded7-4f58-a1e9-46a9164c1eef'::uuid
  AND us.id = cm.user_session_id
  AND cm.match_rank = 1;

COMMIT;

SELECT
  ts.user_session_id,
  ts.tag_english,
  ts.score_percentage,
  ts.question_25_bonus_applied,
  ts.question_25_bonus_tag
FROM tag_statistics ts
WHERE ts.user_session_id = '48e523f9-ded7-4f58-a1e9-46a9164c1eef'::uuid
ORDER BY ts.tag_english;

SELECT
  cm.user_session_id,
  cm.match_rank,
  cm.character_id,
  cm.in_range_count,
  cm.out_of_range_diff_sum,
  cm.final_percentage,
  cm.question_25_answer
FROM character_matches cm
WHERE cm.user_session_id = '48e523f9-ded7-4f58-a1e9-46a9164c1eef'::uuid
ORDER BY cm.match_rank;
