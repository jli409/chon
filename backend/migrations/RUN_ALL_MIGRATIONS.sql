-- Complete migration script for CHON personality test
-- Run this entire script in Supabase SQL Editor

-- ========================================
-- Migration 01: Base tables
-- ========================================

CREATE TABLE IF NOT EXISTS intro_choices (
    choice VARCHAR(10) PRIMARY KEY CHECK (choice IN ('yes', 'no')),
    count INTEGER NOT NULL DEFAULT 0
);

INSERT INTO intro_choices (choice, count) VALUES ('yes', 0) ON CONFLICT (choice) DO NOTHING;
INSERT INTO intro_choices (choice, count) VALUES ('no', 0) ON CONFLICT (choice) DO NOTHING;

CREATE TABLE IF NOT EXISTS question_responses (
    id SERIAL PRIMARY KEY,
    questionnaire_type VARCHAR(20) NOT NULL CHECK (questionnaire_type IN ('mother', 'corporate', 'other', 'both')),
    question_id VARCHAR(50) NOT NULL,
    original_question_id INTEGER NOT NULL,
    question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('multiple-choice', 'scale-question', 'text-input')),
    response_value VARCHAR(50),
    count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_responses_questionnaire_question 
ON question_responses(questionnaire_type, question_id);

ALTER TABLE intro_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY update_intro_choices ON intro_choices FOR UPDATE TO public 
    USING (true) WITH CHECK (true);
CREATE POLICY read_intro_choices ON intro_choices FOR SELECT TO public 
    USING (true);
CREATE POLICY insert_question_responses ON question_responses FOR INSERT TO public 
    WITH CHECK (true);
CREATE POLICY read_question_responses ON question_responses FOR SELECT TO public 
    USING (true);
CREATE POLICY update_question_responses ON question_responses FOR UPDATE TO public 
    USING (true);

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_question_responses_modtime
BEFORE UPDATE ON question_responses
FOR EACH ROW
EXECUTE PROCEDURE update_modified_column();

-- ========================================
-- Migration 02: Email verifications
-- ========================================

CREATE TABLE IF NOT EXISTS email_verifications (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    verification_token VARCHAR(255) UNIQUE NOT NULL,
    session_token VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    is_verified BOOLEAN DEFAULT FALSE,
    questionnaire_type VARCHAR(50) NOT NULL CHECK (questionnaire_type IN ('mother', 'corporate', 'other', 'both'))
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_verification_token ON email_verifications(verification_token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_session_token ON email_verifications(session_token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY insert_email_verifications ON email_verifications FOR INSERT TO public 
    WITH CHECK (true);
CREATE POLICY read_email_verifications ON email_verifications FOR SELECT TO public 
    USING (true);
CREATE POLICY update_email_verifications ON email_verifications FOR UPDATE TO public 
    USING (true);

-- ========================================
-- Migration 03: User sessions
-- ========================================

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intro_choice VARCHAR(10) CHECK (intro_choice IN ('yes', 'no')),
    email VARCHAR(255),
    questionnaire_type VARCHAR(50) CHECK (questionnaire_type IN ('mother', 'corporate', 'other', 'both')),
    corporate_role VARCHAR(100),
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255) UNIQUE,
    session_token VARCHAR(255) UNIQUE,
    verification_token_expires_at TIMESTAMP WITH TIME ZONE,
    questionnaire_completed BOOLEAN DEFAULT FALSE,
    character_match VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_email ON user_sessions(email);
CREATE INDEX IF NOT EXISTS idx_user_sessions_verification_token ON user_sessions(verification_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_questionnaire_type ON user_sessions(questionnaire_type);
CREATE INDEX IF NOT EXISTS idx_user_sessions_completed ON user_sessions(questionnaire_completed);
CREATE INDEX IF NOT EXISTS idx_user_sessions_corporate_role ON user_sessions(corporate_role);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY insert_user_sessions ON user_sessions FOR INSERT TO public 
    WITH CHECK (true);
CREATE POLICY read_user_sessions ON user_sessions FOR SELECT TO public 
    USING (true);
CREATE POLICY update_user_sessions ON user_sessions FOR UPDATE TO public 
    USING (true);

-- ========================================
-- Migration 04: Tag tables
-- ========================================

CREATE TABLE IF NOT EXISTS tag_scores (
    id SERIAL PRIMARY KEY,
    user_session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    tag_english VARCHAR(50) NOT NULL,
    unified_question_id INTEGER NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_session_id, tag_english, unified_question_id)
);

CREATE INDEX IF NOT EXISTS idx_tag_scores_session ON tag_scores(user_session_id);
CREATE INDEX IF NOT EXISTS idx_tag_scores_tag ON tag_scores(tag_english);
CREATE INDEX IF NOT EXISTS idx_tag_scores_unified_question ON tag_scores(unified_question_id);

CREATE TABLE IF NOT EXISTS tag_statistics (
    id SERIAL PRIMARY KEY,
    user_session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    tag_english VARCHAR(50) NOT NULL,
    user_score INTEGER NOT NULL,
    total_possible_score INTEGER NOT NULL,
    score_percentage INTEGER NOT NULL CHECK (score_percentage >= 0 AND score_percentage <= 100),
    answered_questions INTEGER NOT NULL CHECK (answered_questions >= 0),
    question_25_bonus_applied BOOLEAN DEFAULT FALSE,
    question_25_bonus_tag VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_session_id, tag_english)
);

CREATE INDEX IF NOT EXISTS idx_tag_statistics_session ON tag_statistics(user_session_id);
CREATE INDEX IF NOT EXISTS idx_tag_statistics_tag ON tag_statistics(tag_english);

CREATE TABLE IF NOT EXISTS character_matches (
    id SERIAL PRIMARY KEY,
    user_session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    character_id VARCHAR(50) NOT NULL,
    match_rank INTEGER NOT NULL,
    in_range_count INTEGER,
    out_of_range_diff_sum INTEGER,
    final_percentage INTEGER NOT NULL CHECK (final_percentage >= 0 AND final_percentage <= 100),
    question_25_answer VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_character_matches_session ON character_matches(user_session_id);
CREATE INDEX IF NOT EXISTS idx_character_matches_character ON character_matches(character_id);
CREATE INDEX IF NOT EXISTS idx_character_matches_rank ON character_matches(match_rank);

ALTER TABLE tag_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_matches ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE question_responses 
    ADD COLUMN IF NOT EXISTS user_session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE;

ALTER TABLE question_responses 
    ADD COLUMN IF NOT EXISTS score INTEGER CHECK (score >= 0 AND score <= 100);

CREATE INDEX IF NOT EXISTS idx_question_responses_session ON question_responses(user_session_id);

-- ========================================
-- Migration 06: Consolidate and link
-- ========================================

-- Add text response support to question_responses
ALTER TABLE question_responses 
    ADD COLUMN IF NOT EXISTS response_text TEXT,
    ADD COLUMN IF NOT EXISTS is_text_response BOOLEAN DEFAULT FALSE;

-- Create view for backward compatibility
CREATE OR REPLACE VIEW text_responses AS
SELECT 
    id,
    questionnaire_type,
    question_id,
    original_question_id,
    response_text as response_text,
    user_session_id,
    created_at,
    updated_at
FROM question_responses
WHERE is_text_response = TRUE;

-- Link email_verifications to user_sessions
ALTER TABLE email_verifications
    ADD COLUMN IF NOT EXISTS user_session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_email_verifications_session ON email_verifications(user_session_id);

-- Add index for text responses
CREATE INDEX IF NOT EXISTS idx_question_responses_text ON question_responses(is_text_response);

-- ========================================
-- Migration 07: User accounts
-- ========================================

CREATE TABLE IF NOT EXISTS user_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_accounts_session ON user_accounts(user_session_id);
CREATE INDEX IF NOT EXISTS idx_user_accounts_email ON user_accounts(email);

ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY insert_user_accounts ON user_accounts FOR INSERT TO public 
    WITH CHECK (true);
CREATE POLICY read_user_accounts ON user_accounts FOR SELECT TO public 
    USING (true);
CREATE POLICY update_user_accounts ON user_accounts FOR UPDATE TO public 
    USING (true);

-- ========================================
-- Migration 08: Auth sync hooks
-- ========================================

ALTER TABLE email_verifications
    ALTER COLUMN questionnaire_type DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_from_auth()
RETURNS TRIGGER AS $$
DECLARE
    v_latest_session_id UUID;
    v_latest_email_verification_id INTEGER;
    v_session_token TEXT;
    v_questionnaire_type TEXT;
BEGIN
    SELECT id INTO v_latest_session_id
    FROM public.user_sessions
    WHERE email = NEW.email
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1;

    IF v_latest_session_id IS NOT NULL THEN
        SELECT session_token, questionnaire_type
        INTO v_session_token, v_questionnaire_type
        FROM public.user_sessions
        WHERE id = v_latest_session_id;
    END IF;

    IF v_latest_session_id IS NOT NULL THEN
        UPDATE public.user_sessions
        SET email = NEW.email
        WHERE id = v_latest_session_id;
    END IF;

    SELECT id INTO v_latest_email_verification_id
    FROM public.email_verifications
    WHERE email = NEW.email
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1;

    IF v_latest_email_verification_id IS NOT NULL THEN
        UPDATE public.email_verifications
        SET email = NEW.email,
            verification_token = NEW.id::text,
            expires_at = COALESCE(expires_at, NOW() + INTERVAL '30 days'),
            questionnaire_type = COALESCE(questionnaire_type, v_questionnaire_type),
            session_token = COALESCE(session_token, v_session_token),
            user_session_id = COALESCE(user_session_id, v_latest_session_id)
        WHERE id = v_latest_email_verification_id;
    ELSE
        INSERT INTO public.email_verifications (
            email,
            verification_token,
            expires_at,
            questionnaire_type,
            session_token,
            user_session_id
        ) VALUES (
            NEW.email,
            NEW.id::text,
            NOW() + INTERVAL '30 days',
            v_questionnaire_type,
            v_session_token,
            v_latest_session_id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_auth_users ON auth.users;
CREATE TRIGGER sync_auth_users
AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.sync_from_auth();

-- ========================================
-- Migration Complete
-- ========================================

SELECT 'All migrations applied successfully!' as status;

