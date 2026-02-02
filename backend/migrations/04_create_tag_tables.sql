-- Create tag_scores table to store per-question per-tag scores
CREATE TABLE IF NOT EXISTS tag_scores (
    id SERIAL PRIMARY KEY,
    user_session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    tag_english VARCHAR(50) NOT NULL, -- Changed from tag_chinese to tag_english
    unified_question_id INTEGER NOT NULL, -- Unique question ID from unified questions (e.g., 5, 10, 15)
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_session_id, tag_english, unified_question_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tag_scores_session ON tag_scores(user_session_id);
CREATE INDEX IF NOT EXISTS idx_tag_scores_tag ON tag_scores(tag_english);
CREATE INDEX IF NOT EXISTS idx_tag_scores_unified_question ON tag_scores(unified_question_id);

-- Create tag_statistics table to store calculated tag statistics
CREATE TABLE IF NOT EXISTS tag_statistics (
    id SERIAL PRIMARY KEY,
    user_session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    tag_english VARCHAR(50) NOT NULL, -- Changed from tag_chinese to tag_english
    user_score INTEGER NOT NULL,
    total_possible_score INTEGER NOT NULL,
    score_percentage INTEGER NOT NULL CHECK (score_percentage >= 0 AND score_percentage <= 100),
    answered_questions INTEGER NOT NULL CHECK (answered_questions >= 0),
    question_25_bonus_applied BOOLEAN DEFAULT FALSE,
    question_25_bonus_tag VARCHAR(50), -- Which tag got the +10% bonus
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_session_id, tag_english)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tag_statistics_session ON tag_statistics(user_session_id);
CREATE INDEX IF NOT EXISTS idx_tag_statistics_tag ON tag_statistics(tag_english);

-- Create character_matches table to store character matching results
CREATE TABLE IF NOT EXISTS character_matches (
    id SERIAL PRIMARY KEY,
    user_session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    character_id VARCHAR(50) NOT NULL, -- 'prometheus', 'wukong', 'odin', 'venus', 'nuwa', 'athena'
    match_rank INTEGER NOT NULL, -- 1 = best match, 2 = second best, etc.
    in_range_count INTEGER, -- How many skills in character's range
    out_of_range_diff_sum INTEGER, -- Sum of differences for out-of-range
    final_percentage INTEGER NOT NULL CHECK (final_percentage >= 0 AND final_percentage <= 100),
    question_25_answer VARCHAR(10), -- 'A', 'B', 'C', 'D', 'E', 'F'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_character_matches_session ON character_matches(user_session_id);
CREATE INDEX IF NOT EXISTS idx_character_matches_character ON character_matches(character_id);
CREATE INDEX IF NOT EXISTS idx_character_matches_rank ON character_matches(match_rank);

-- Enable RLS for all tables
ALTER TABLE tag_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_matches ENABLE ROW LEVEL SECURITY;

-- Create policies (allow public access for now)
CREATE POLICY insert_tag_scores ON tag_scores FOR INSERT TO public 
    WITH CHECK (true);
CREATE POLICY read_tag_scores ON tag_scores FOR SELECT TO public 
    USING (true);
CREATE POLICY insert_tag_statistics ON tag_statistics FOR INSERT TO public 
    WITH CHECK (true);
CREATE POLICY read_tag_statistics ON tag_statistics FOR SELECT TO public 
    USING (true);
CREATE POLICY insert_character_matches ON character_matches FOR INSERT TO public 
    WITH CHECK (true);
CREATE POLICY read_character_matches ON character_matches FOR SELECT TO public 
    USING (true);

-- Add user_session_id and score to question_responses
ALTER TABLE question_responses 
    ADD COLUMN IF NOT EXISTS user_session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE;

ALTER TABLE question_responses 
    ADD COLUMN IF NOT EXISTS score INTEGER CHECK (score >= 0 AND score <= 100);

-- Create index for user_session_id
CREATE INDEX IF NOT EXISTS idx_question_responses_session ON question_responses(user_session_id);

-- Drop old unique constraint and create new one
ALTER TABLE question_responses 
    DROP CONSTRAINT IF EXISTS question_responses_questionnaire_type_question_id_response_key;

-- Note: We keep the old column structure for backward compatibility
-- New rows will have user_session_id, old rows will have it as NULL
-- This allows both aggregate (old) and individual (new) data to coexist

