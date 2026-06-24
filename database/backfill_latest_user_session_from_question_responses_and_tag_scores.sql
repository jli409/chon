-- =============================================================================
-- Backfill latest user_session from question_responses + tag_scores
-- =============================================================================
-- Why this exists:
-- - Some previous "latest" scripts scope by latest email_verifications row or only
--   insert missing rows. That can skip the newest user_sessions row or keep
--   incomplete data as-is.
--
-- What this script does (latest user_sessions row by created_at/id):
-- 1) Insert missing tag_scores for that session from question_responses scale answers.
-- 2) Insert missing canonical (6) tag_statistics rows from tag_scores.
-- 3) Insert 6 character_matches rows when the session currently has none.
-- 4) Set user_sessions.questionnaire_completed = TRUE and character_match top-1.
--
-- Safe to dry-run inside BEGIN ... ROLLBACK first.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- PREVIEW
-- -----------------------------------------------------------------------------
SELECT
  s.user_session_id,
  (SELECT COUNT(*) FROM question_responses qr WHERE qr.user_session_ids @> ARRAY[s.user_session_id]::uuid[]) AS question_response_rows,
  (SELECT COUNT(*) FROM tag_scores tsc WHERE tsc.user_session_id = s.user_session_id) AS tag_score_rows_before,
  (SELECT COUNT(*) FROM tag_statistics ts WHERE ts.user_session_id = s.user_session_id) AS tag_statistics_rows_before,
  (SELECT COUNT(*) FROM character_matches cm WHERE cm.user_session_id = s.user_session_id) AS character_match_rows_before
FROM (
  SELECT us.id AS user_session_id
  FROM user_sessions us
  ORDER BY us.created_at DESC NULLS LAST, us.id DESC
  LIMIT 1
) s;

-- -----------------------------------------------------------------------------
-- 1) Insert missing tag_scores from question_responses (scale questions only)
-- -----------------------------------------------------------------------------
WITH latest_session AS (
  SELECT us.id AS user_session_id
  FROM user_sessions us
  ORDER BY us.created_at DESC NULLS LAST, us.id DESC
  LIMIT 1
),
static_tag_map(unified_question_id, tag_english) AS (
  SELECT * FROM (VALUES
    (13, 'objectivity'),
    (14, 'objectivity'),
    (14, 'coreEndurance'),
    (15, 'objectivity'),
    (15, 'socialIntelligence'),
    (16, 'socialIntelligence'),
    (17, 'socialIntelligence'),
    (18, 'objectivity'),
    (18, 'dedication'),
    (19, 'socialIntelligence'),
    (19, 'dedication'),
    (20, 'dedication'),
    (24, 'objectivity'),
    (26, 'objectivity'),
    (26, 'emotionalRegulation'),
    (27, 'objectivity'),
    (28, 'dedication'),
    (29, 'dedication'),
    (30, 'dedication'),
    (31, 'dedication'),
    (32, 'objectivity'),
    (33, 'socialIntelligence'),
    (34, 'socialIntelligence'),
    (35, 'dedication'),
    (36, 'objectivity'),
    (37, 'emotionalRegulation'),
    (38, 'objectivity'),
    (40, 'selfAwareness'),
    (41, 'socialIntelligence'),
    (42, 'coreEndurance'),
    (43, 'socialIntelligence'),
    (44, 'objectivity'),
    (44, 'dedication'),
    (45, 'objectivity'),
    (45, 'dedication'),
    (46, 'dedication'),
    (47, 'dedication'),
    (48, 'dedication'),
    (49, 'socialIntelligence'),
    (50, 'emotionalRegulation'),
    (50, 'dedication'),
    (51, 'selfAwareness'),
    (59, 'socialIntelligence'),
    (61, 'selfAwareness'),
    (63, 'selfAwareness'),
    (64, 'emotionalRegulation'),
    (65, 'emotionalRegulation'),
    (65, 'coreEndurance'),
    (66, 'coreEndurance'),
    (67, 'selfAwareness'),
    (68, 'selfAwareness'),
    (69, 'socialIntelligence'),
    (70, 'socialIntelligence'),
    (71, 'selfAwareness'),
    (72, 'objectivity'),
    (73, 'coreEndurance'),
    (74, 'selfAwareness'),
    (75, 'socialIntelligence'),
    (76, 'dedication'),
    (77, 'emotionalRegulation'),
    (77, 'coreEndurance'),
    (78, 'selfAwareness'),
    (79, 'selfAwareness'),
    (80, 'selfAwareness'),
    (81, 'selfAwareness'),
    (82, 'socialIntelligence'),
    (83, 'dedication'),
    (84, 'dedication'),
    (85, 'selfAwareness'),
    (86, 'objectivity'),
    (86, 'dedication'),
    (87, 'emotionalRegulation'),
    (87, 'socialIntelligence'),
    (88, 'socialIntelligence'),
    (89, 'emotionalRegulation')
  ) v(unified_question_id, tag_english)
),
conditional_tag_map(unified_question_id, tag_if_male, tag_if_female) AS (
  SELECT * FROM (VALUES
    (21, 'objectivity', 'selfAwareness'),
    (22, 'dedication', 'selfAwareness'),
    (23, 'dedication', 'selfAwareness')
  ) c(unified_question_id, tag_if_male, tag_if_female)
),
session_sex AS (
  SELECT DISTINCT ON (s.user_session_id)
    s.user_session_id,
    UPPER(SUBSTRING(TRIM(COALESCE(qr.response_value, qr.response_text, '')), 1, 1)) AS sex
  FROM latest_session s
  JOIN question_responses qr
    ON qr.user_session_ids @> ARRAY[s.user_session_id]::uuid[]
  WHERE qr.original_question_id = 1
    AND COALESCE(qr.is_text_response, FALSE) IS NOT TRUE
    AND qr.question_type = 'multiple-choice'
    AND UPPER(SUBSTRING(TRIM(COALESCE(qr.response_value, qr.response_text, '')), 1, 1)) IN ('A', 'B')
  ORDER BY s.user_session_id, qr.updated_at DESC NULLS LAST, qr.created_at DESC, qr.id DESC
),
latest_scale AS (
  SELECT DISTINCT ON (s.user_session_id, qr.original_question_id)
    s.user_session_id,
    qr.original_question_id,
    qr.score AS stored_score,
    TRIM(COALESCE(qr.response_value, '')) AS rv
  FROM latest_session s
  JOIN question_responses qr
    ON qr.user_session_ids @> ARRAY[s.user_session_id]::uuid[]
  WHERE qr.question_type = 'scale-question'
    AND COALESCE(qr.is_text_response, FALSE) IS NOT TRUE
    AND TRIM(COALESCE(qr.response_value, '')) <> ''
  ORDER BY s.user_session_id, qr.original_question_id, qr.updated_at DESC NULLS LAST, qr.created_at DESC, qr.id DESC
),
scale_pct AS (
  SELECT
    ls.user_session_id,
    ls.original_question_id,
    CASE
      WHEN ls.stored_score IS NOT NULL AND ls.stored_score BETWEEN 0 AND 100 THEN ls.stored_score
      WHEN ls.rv ~ '^[1-5]$' THEN ls.rv::int * 20
      WHEN UPPER(ls.rv) = 'A' THEN 20
      WHEN UPPER(ls.rv) = 'B' THEN 40
      WHEN UPPER(ls.rv) = 'C' THEN 60
      WHEN UPPER(ls.rv) = 'D' THEN 80
      WHEN UPPER(ls.rv) = 'E' THEN 100
      ELSE NULL
    END::int AS pct
  FROM latest_scale ls
),
static_lines AS (
  SELECT
    sp.user_session_id,
    sp.original_question_id AS unified_question_id,
    m.tag_english,
    sp.pct
  FROM scale_pct sp
  JOIN static_tag_map m ON m.unified_question_id = sp.original_question_id
  WHERE sp.pct IS NOT NULL
),
cond_lines AS (
  SELECT
    sp.user_session_id,
    sp.original_question_id AS unified_question_id,
    CASE ss.sex
      WHEN 'B' THEN c.tag_if_male
      WHEN 'A' THEN c.tag_if_female
      ELSE NULL
    END AS tag_english,
    sp.pct
  FROM scale_pct sp
  JOIN conditional_tag_map c ON c.unified_question_id = sp.original_question_id
  LEFT JOIN session_sex ss ON ss.user_session_id = sp.user_session_id
  WHERE sp.pct IS NOT NULL
    AND ss.sex IN ('A', 'B')
),
tag_lines AS (
  SELECT * FROM static_lines
  UNION ALL
  SELECT * FROM cond_lines WHERE tag_english IS NOT NULL
)
INSERT INTO tag_scores (user_session_id, tag_english, unified_question_id, score)
SELECT
  tl.user_session_id,
  tl.tag_english,
  tl.unified_question_id,
  LEAST(100, GREATEST(0, tl.pct))::int
FROM tag_lines tl
WHERE NOT EXISTS (
  SELECT 1
  FROM tag_scores existing
  WHERE existing.user_session_id = tl.user_session_id
    AND existing.tag_english = tl.tag_english
    AND existing.unified_question_id = tl.unified_question_id
);

-- -----------------------------------------------------------------------------
-- 2) Insert missing canonical 6 tag_statistics rows from tag_scores
-- -----------------------------------------------------------------------------
WITH latest_session AS (
  SELECT us.id AS user_session_id
  FROM user_sessions us
  ORDER BY us.created_at DESC NULLS LAST, us.id DESC
  LIMIT 1
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
  JOIN latest_session s ON s.user_session_id = sc.user_session_id
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
),
filled AS (
  SELECT
    s.user_session_id,
    c.tag_english,
    COALESCE(a.user_score, 0) AS user_score,
    COALESCE(a.total_possible_score, 0) AS total_possible_score,
    COALESCE(a.score_percentage, 0)::int AS score_percentage,
    COALESCE(a.answered_questions, 0) AS answered_questions
  FROM latest_session s
  CROSS JOIN canon c
  LEFT JOIN agg a ON a.user_session_id = s.user_session_id AND a.tag_english = c.tag_english
),
missing AS (
  SELECT
    f.user_session_id,
    f.tag_english,
    f.user_score,
    f.total_possible_score,
    f.score_percentage,
    f.answered_questions
  FROM filled f
  LEFT JOIN tag_statistics ts
    ON ts.user_session_id = f.user_session_id
   AND ts.tag_english = f.tag_english
  WHERE ts.id IS NULL
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
  user_session_id,
  tag_english,
  user_score,
  total_possible_score,
  score_percentage,
  answered_questions,
  FALSE,
  NULL
FROM missing;

-- Apply Q25 +10% bonus on mapped tag.
WITH latest_session AS (
  SELECT us.id AS user_session_id
  FROM user_sessions us
  ORDER BY us.created_at DESC NULLS LAST, us.id DESC
  LIMIT 1
),
q25 AS (
  SELECT DISTINCT ON (s.user_session_id)
    s.user_session_id,
    UPPER(
      SUBSTRING(
        TRIM(COALESCE(NULLIF(TRIM(qr.response_value), ''), NULLIF(TRIM(qr.response_text), ''))),
        1,
        1
      )
    ) AS ch
  FROM latest_session s
  JOIN question_responses qr
    ON qr.user_session_ids @> ARRAY[s.user_session_id]::uuid[]
  WHERE COALESCE(qr.is_text_response, FALSE) IS NOT TRUE
    AND qr.question_type = 'multiple-choice'
    AND (
      qr.original_question_id = 25
      OR qr.question_id::text IN ('mother_33', 'corporate_33', 'other_29', 'both_45')
      OR (qr.questionnaire_type = 'mother' AND qr.original_question_id = 33)
      OR (qr.questionnaire_type = 'corporate' AND qr.original_question_id = 33)
      OR (qr.questionnaire_type = 'other' AND qr.original_question_id = 29)
      OR (qr.questionnaire_type = 'both' AND qr.original_question_id = 45)
    )
    AND UPPER(
      SUBSTRING(
        TRIM(COALESCE(NULLIF(TRIM(qr.response_value), ''), NULLIF(TRIM(qr.response_text), ''))),
        1,
        1
      )
    ) IN ('A', 'B', 'C', 'D', 'E', 'F')
  ORDER BY s.user_session_id, qr.updated_at DESC NULLS LAST, qr.created_at DESC, qr.id DESC
),
bonus AS (
  SELECT
    user_session_id,
    CASE ch
      WHEN 'A' THEN 'dedication'
      WHEN 'B' THEN 'emotionalRegulation'
      WHEN 'C' THEN 'selfAwareness'
      WHEN 'D' THEN 'socialIntelligence'
      WHEN 'E' THEN 'coreEndurance'
      WHEN 'F' THEN 'objectivity'
    END AS bonus_tag
  FROM q25
)
UPDATE tag_statistics ts
SET
  question_25_bonus_applied = TRUE,
  question_25_bonus_tag = b.bonus_tag,
  score_percentage = LEAST(100, ts.score_percentage + 10),
  user_score = CASE
    WHEN ts.total_possible_score > 0
    THEN ROUND((LEAST(100, ts.score_percentage + 10)::numeric / 100.0) * ts.total_possible_score)::int
    ELSE ts.user_score
  END
FROM bonus b
WHERE ts.user_session_id = b.user_session_id
  AND ts.tag_english = b.bonus_tag
  AND COALESCE(ts.question_25_bonus_applied, FALSE) IS NOT TRUE;

-- -----------------------------------------------------------------------------
-- 3) Insert character_matches (all 6 rows) only when session has none
-- -----------------------------------------------------------------------------
WITH latest_session AS (
  SELECT us.id AS user_session_id
  FROM user_sessions us
  ORDER BY us.created_at DESC NULLS LAST, us.id DESC
  LIMIT 1
),
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
  JOIN latest_session s ON s.user_session_id = ts.user_session_id
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
q25_cm AS (
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
  FROM latest_session s
  JOIN question_responses qr
    ON qr.user_session_ids @> ARRAY[s.user_session_id]::uuid[]
  WHERE NOT COALESCE(qr.is_text_response, FALSE)
    AND qr.question_type = 'multiple-choice'
    AND (
      qr.original_question_id = 25
      OR qr.question_id::text IN ('mother_33', 'corporate_33', 'other_29', 'both_45')
      OR (qr.questionnaire_type = 'mother' AND qr.original_question_id = 33)
      OR (qr.questionnaire_type = 'corporate' AND qr.original_question_id = 33)
      OR (qr.questionnaire_type = 'other' AND qr.original_question_id = 29)
      OR (qr.questionnaire_type = 'both' AND qr.original_question_id = 45)
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
  LEFT JOIN q25_cm q ON q.user_session_id = s.user_session_id
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
    w.in_range_count,
    w.out_of_range_diff_sum,
    w.final_percentage,
    w.q25,
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
    ) AS match_rank
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
  user_session_id,
  character_id,
  match_rank,
  in_range_count,
  out_of_range_diff_sum,
  final_percentage,
  q25
FROM ranked
WHERE NOT EXISTS (
  SELECT 1
  FROM character_matches cm
  WHERE cm.user_session_id = ranked.user_session_id
);

-- -----------------------------------------------------------------------------
-- 4) Mark latest user_session completed and set top match
-- -----------------------------------------------------------------------------
UPDATE user_sessions us
SET
  questionnaire_completed = TRUE,
  character_match = best.character_id,
  completed_at = COALESCE(us.completed_at, NOW())
FROM (
  WITH latest_session AS (
    SELECT us.id AS user_session_id
    FROM user_sessions us
    ORDER BY us.created_at DESC NULLS LAST, us.id DESC
    LIMIT 1
  )
  SELECT DISTINCT ON (cm.user_session_id)
    cm.user_session_id,
    cm.character_id
  FROM character_matches cm
  JOIN latest_session s ON s.user_session_id = cm.user_session_id
  ORDER BY cm.user_session_id, cm.match_rank ASC NULLS LAST, cm.id ASC
) best
WHERE us.id = best.user_session_id;

-- -----------------------------------------------------------------------------
-- VERIFY
-- -----------------------------------------------------------------------------
SELECT
  s.user_session_id,
  us.questionnaire_completed,
  us.character_match,
  (SELECT COUNT(*) FROM tag_scores tsc WHERE tsc.user_session_id = s.user_session_id) AS tag_scores_rows_after,
  (SELECT COUNT(*) FROM tag_statistics ts WHERE ts.user_session_id = s.user_session_id) AS tag_statistics_rows_after,
  (SELECT COUNT(*) FROM character_matches cm WHERE cm.user_session_id = s.user_session_id) AS character_match_rows_after
FROM (
  SELECT us.id AS user_session_id
  FROM user_sessions us
  ORDER BY us.created_at DESC NULLS LAST, us.id DESC
  LIMIT 1
) s
JOIN user_sessions us ON us.id = s.user_session_id;

COMMIT;
