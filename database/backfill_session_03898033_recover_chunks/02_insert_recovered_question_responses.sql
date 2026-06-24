-- Insert reconstructed question_responses with real app-shaped IDs.
-- Values are derived from tag_statistics aggregates, not original raw answers.
BEGIN;

WITH
session_info AS (
  SELECT
    '03898033-e7af-429f-ad8f-51a5b8b5a737'::uuid AS user_session_id,
    COALESCE(
      (SELECT questionnaire_type FROM user_sessions WHERE id = '03898033-e7af-429f-ad8f-51a5b8b5a737'::uuid),
      'other'
    ) AS questionnaire_type
),
question_map AS (
  SELECT 'mother' AS questionnaire_type, ordinality::int AS local_index, unified_id::int AS unified_question_id
  FROM unnest(ARRAY[2,4,5,52,53,54,55,56,57,58,59,60,61,64,65,69,27,71,28,31,30,33,40,41,42,43,73,74,75,76,77,51,25]) WITH ORDINALITY AS x(unified_id, ordinality)
  UNION ALL
  SELECT 'corporate', ordinality::int, unified_id::int
  FROM unnest(ARRAY[1,2,5,7,8,9,10,11,13,15,16,17,20,21,23,24,27,28,30,31,33,34,36,37,40,41,42,43,45,46,49,51,25]) WITH ORDINALITY AS x(unified_id, ordinality)
  UNION ALL
  SELECT 'other', ordinality::int, unified_id::int
  FROM unnest(ARRAY[1,2,4,5,81,20,83,84,85,87,89,24,27,28,30,31,33,34,36,37,40,41,42,43,45,46,49,51,25]) WITH ORDINALITY AS x(unified_id, ordinality)
  UNION ALL
  SELECT 'both', ordinality::int, unified_id::int
  FROM unnest(ARRAY[2,5,52,53,54,55,56,57,58,7,8,9,10,11,13,15,16,17,20,21,23,24,59,60,61,64,65,69,27,71,28,31,30,33,40,41,42,43,73,74,75,76,77,51,25]) WITH ORDINALITY AS x(unified_id, ordinality)
),
tag_map(unified_question_id, tag_english) AS (
  SELECT * FROM (VALUES
    (13, 'objectivity'), (14, 'objectivity'), (14, 'coreEndurance'),
    (15, 'objectivity'), (15, 'socialIntelligence'),
    (16, 'socialIntelligence'), (17, 'socialIntelligence'),
    (18, 'objectivity'), (18, 'dedication'),
    (19, 'socialIntelligence'), (19, 'dedication'), (20, 'dedication'),
    (24, 'objectivity'), (26, 'objectivity'), (26, 'emotionalRegulation'),
    (27, 'objectivity'), (28, 'dedication'), (29, 'dedication'),
    (30, 'dedication'), (31, 'dedication'), (32, 'objectivity'),
    (33, 'socialIntelligence'), (34, 'socialIntelligence'), (35, 'dedication'),
    (36, 'objectivity'), (37, 'emotionalRegulation'), (38, 'objectivity'),
    (40, 'selfAwareness'), (41, 'socialIntelligence'), (42, 'coreEndurance'),
    (43, 'socialIntelligence'), (44, 'objectivity'), (44, 'dedication'),
    (45, 'objectivity'), (45, 'dedication'), (46, 'dedication'),
    (47, 'dedication'), (48, 'dedication'), (49, 'socialIntelligence'),
    (50, 'emotionalRegulation'), (50, 'dedication'), (51, 'selfAwareness'),
    (59, 'socialIntelligence'), (61, 'selfAwareness'), (63, 'selfAwareness'),
    (64, 'emotionalRegulation'), (65, 'emotionalRegulation'), (65, 'coreEndurance'),
    (66, 'coreEndurance'), (67, 'selfAwareness'), (68, 'selfAwareness'),
    (69, 'socialIntelligence'), (70, 'socialIntelligence'), (71, 'selfAwareness'),
    (72, 'objectivity'), (73, 'coreEndurance'), (74, 'selfAwareness'),
    (75, 'socialIntelligence'), (76, 'dedication'),
    (77, 'emotionalRegulation'), (77, 'coreEndurance'),
    (78, 'selfAwareness'), (79, 'selfAwareness'), (80, 'selfAwareness'),
    (81, 'selfAwareness'), (82, 'socialIntelligence'), (83, 'dedication'),
    (84, 'dedication'), (85, 'selfAwareness'),
    (86, 'objectivity'), (86, 'dedication'),
    (87, 'emotionalRegulation'), (87, 'socialIntelligence'),
    (88, 'socialIntelligence'), (89, 'emotionalRegulation')
  ) v(unified_question_id, tag_english)
),
source_stats AS (
  SELECT
    ts.user_session_id,
    ts.tag_english,
    ts.user_score,
    ts.answered_questions,
    si.questionnaire_type
  FROM tag_statistics ts
  CROSS JOIN session_info si
  WHERE ts.user_session_id = si.user_session_id
    AND ts.answered_questions > 0
),
chosen AS (
  SELECT
    s.*,
    qm.local_index,
    qm.unified_question_id,
    ROW_NUMBER() OVER (
      PARTITION BY s.tag_english
      ORDER BY qm.local_index
    ) AS answer_index
  FROM source_stats s
  INNER JOIN tag_map tm ON tm.tag_english = s.tag_english
  INNER JOIN question_map qm
    ON qm.questionnaire_type = s.questionnaire_type
   AND qm.unified_question_id = tm.unified_question_id
),
expanded AS (
  SELECT
    user_session_id,
    questionnaire_type,
    tag_english,
    local_index,
    unified_question_id,
    answer_index,
    LEAST(
      100,
      GREATEST(
        0,
        FLOOR(user_score::numeric / answered_questions)::int
        + CASE WHEN answer_index <= MOD(user_score, answered_questions) THEN 1 ELSE 0 END
      )
    )::int AS recovered_score
  FROM chosen
  WHERE answer_index <= answered_questions
),
deduped AS (
  SELECT DISTINCT ON (questionnaire_type, local_index, unified_question_id)
    *
  FROM expanded
  ORDER BY questionnaire_type, local_index, unified_question_id, recovered_score DESC, tag_english
)
INSERT INTO question_responses (
  questionnaire_type,
  question_id,
  original_question_id,
  question_type,
  response_value,
  response_text,
  is_text_response,
  score,
  count,
  user_session_ids,
  created_at,
  updated_at
)
SELECT
  questionnaire_type,
  questionnaire_type || '_' || local_index,
  unified_question_id,
  'scale-question',
  recovered_score::text,
  recovered_score::text,
  FALSE,
  recovered_score,
  1,
  ARRAY[user_session_id],
  NOW(),
  NOW()
FROM deduped;

COMMIT;
