-- Compact insert of rebuilt character_matches for the two target sessions.
-- Run 05a_delete_character_matches.sql first.
BEGIN;

WITH scores_raw AS (
  SELECT ts.user_session_id,
    MAX(CASE WHEN ts.tag_english = 'selfAwareness' THEN ts.score_percentage END) AS sa,
    MAX(CASE WHEN ts.tag_english = 'dedication' THEN ts.score_percentage END) AS de,
    MAX(CASE WHEN ts.tag_english = 'socialIntelligence' THEN ts.score_percentage END) AS si,
    MAX(CASE WHEN ts.tag_english = 'emotionalRegulation' THEN ts.score_percentage END) AS er,
    MAX(CASE WHEN ts.tag_english = 'objectivity' THEN ts.score_percentage END) AS ob,
    MAX(CASE WHEN ts.tag_english = 'coreEndurance' THEN ts.score_percentage END) AS ce,
    MAX(CASE ts.question_25_bonus_tag WHEN 'dedication' THEN 'A' WHEN 'emotionalRegulation' THEN 'B' WHEN 'selfAwareness' THEN 'C' WHEN 'socialIntelligence' THEN 'D' WHEN 'coreEndurance' THEN 'E' WHEN 'objectivity' THEN 'F' END) AS q25
  FROM tag_statistics ts
  WHERE ts.user_session_id IN ('ad8cf96b-578d-439d-80d7-9f137cc2a251'::uuid, '58f9f855-be87-4214-b732-3129ebdbc36e'::uuid)
  GROUP BY ts.user_session_id
),
scores AS (
  SELECT r.user_session_id, r.sa, r.de, r.si, r.er, r.ob, r.q25,
    CASE WHEN r.sa IS NOT NULL AND r.de IS NOT NULL AND r.si IS NOT NULL AND r.er IS NOT NULL AND r.ob IS NOT NULL AND r.ce IS NOT NULL
      THEN LEAST(100, GREATEST(0, r.ce::numeric + CASE WHEN ((r.sa + r.de + r.si + r.er + r.ob)::numeric / 5.0) > 60 THEN ((r.sa + r.de + r.si + r.er + r.ob)::numeric / 5.0) - 60 ELSE 0 END))::int
      ELSE r.ce
    END AS ce
  FROM scores_raw r
),
chars AS (
  SELECT * FROM (VALUES
    ('odin',        80, 100, 20, 60, 30, 60, 40, 60, 60, 80, 40, 60),
    ('wukong',      40, 60, 40, 60, 40, 70, 80, 100, 40, 60, 40, 60),
    ('prometheus',  30, 60, 80, 100, 30, 60, 30, 50, 30, 70, 60, 80),
    ('nuwa', 0, 40, 50, 80, 40, 60, 60, 80, 40, 60, 80, 100),
    ('athena', 60, 80, 0, 40, 50, 70, 40, 60, 70, 100, 40, 60),
    ('venus', 60, 80, 40, 60, 80, 100, 40, 70, 30, 60, 20, 50)
  ) AS v(character_id, sa_lo, sa_hi, de_lo, de_hi, si_lo, si_hi, er_lo, er_hi, ob_lo, ob_hi, ce_lo, ce_hi)
),
metrics AS (
  SELECT s.user_session_id, c.character_id, s.q25,
    (CASE WHEN s.sa BETWEEN c.sa_lo AND c.sa_hi THEN 1 ELSE 0 END) + (CASE WHEN s.de BETWEEN c.de_lo AND c.de_hi THEN 1 ELSE 0 END) + (CASE WHEN s.si BETWEEN c.si_lo AND c.si_hi THEN 1 ELSE 0 END) + (CASE WHEN s.er BETWEEN c.er_lo AND c.er_hi THEN 1 ELSE 0 END) + (CASE WHEN s.ob BETWEEN c.ob_lo AND c.ob_hi THEN 1 ELSE 0 END) + (CASE WHEN s.ce BETWEEN c.ce_lo AND c.ce_hi THEN 1 ELSE 0 END) AS in_range_count,
    (CASE WHEN s.sa < c.sa_lo THEN c.sa_lo - s.sa WHEN s.sa > c.sa_hi THEN s.sa - c.sa_hi ELSE 0 END) + (CASE WHEN s.de < c.de_lo THEN c.de_lo - s.de WHEN s.de > c.de_hi THEN s.de - c.de_hi ELSE 0 END) + (CASE WHEN s.si < c.si_lo THEN c.si_lo - s.si WHEN s.si > c.si_hi THEN s.si - c.si_hi ELSE 0 END) + (CASE WHEN s.er < c.er_lo THEN c.er_lo - s.er WHEN s.er > c.er_hi THEN s.er - c.er_hi ELSE 0 END) + (CASE WHEN s.ob < c.ob_lo THEN c.ob_lo - s.ob WHEN s.ob > c.ob_hi THEN s.ob - c.ob_hi ELSE 0 END) + (CASE WHEN s.ce < c.ce_lo THEN c.ce_lo - s.ce WHEN s.ce > c.ce_hi THEN s.ce - c.ce_hi ELSE 0 END) AS out_of_range_diff_sum
  FROM scores s CROSS JOIN chars c
),
ranked AS (
  SELECT m.*, ROUND((m.in_range_count::numeric / 6.0) * 100)::int AS final_percentage,
    ROW_NUMBER() OVER (PARTITION BY m.user_session_id ORDER BY m.in_range_count DESC, m.out_of_range_diff_sum ASC,
      CASE m.q25 WHEN 'A' THEN CASE WHEN m.character_id = 'prometheus' THEN 0 ELSE 1 END WHEN 'B' THEN CASE WHEN m.character_id = 'wukong' THEN 0 ELSE 1 END WHEN 'C' THEN CASE WHEN m.character_id = 'odin' THEN 0 ELSE 1 END WHEN 'D' THEN CASE WHEN m.character_id = 'venus' THEN 0 ELSE 1 END WHEN 'E' THEN CASE WHEN m.character_id = 'nuwa' THEN 0 ELSE 1 END WHEN 'F' THEN CASE WHEN m.character_id = 'athena' THEN 0 ELSE 1 END ELSE 0 END,
      m.character_id) AS match_rank
  FROM metrics m
)
INSERT INTO character_matches (user_session_id, character_id, match_rank, in_range_count, out_of_range_diff_sum, final_percentage, question_25_answer)
SELECT user_session_id, character_id, match_rank, in_range_count, out_of_range_diff_sum, final_percentage, q25
FROM ranked;

COMMIT;
