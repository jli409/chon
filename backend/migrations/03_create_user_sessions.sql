-- Create user_sessions table to track individual user sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intro_choice VARCHAR(10) CHECK (intro_choice IN ('yes', 'no')),
    email VARCHAR(255),
    questionnaire_type VARCHAR(50) CHECK (questionnaire_type IN ('mother', 'corporate', 'other', 'both')),
    corporate_role VARCHAR(100), -- For corporate questionnaire: 'ceo', 'vp', 'director', 'senior_manager', etc.
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255) UNIQUE,
    session_token VARCHAR(255) UNIQUE,
    verification_token_expires_at TIMESTAMP WITH TIME ZONE,
    questionnaire_completed BOOLEAN DEFAULT FALSE,
    character_match VARCHAR(50), -- 'prometheus', 'wukong', 'odin', 'venus', 'nuwa', 'athena'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_email ON user_sessions(email);
CREATE INDEX IF NOT EXISTS idx_user_sessions_verification_token ON user_sessions(verification_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_questionnaire_type ON user_sessions(questionnaire_type);
CREATE INDEX IF NOT EXISTS idx_user_sessions_completed ON user_sessions(questionnaire_completed);
CREATE INDEX IF NOT EXISTS idx_user_sessions_corporate_role ON user_sessions(corporate_role);

-- Enable RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies (allow public access for now, can restrict later)
CREATE POLICY insert_user_sessions ON user_sessions FOR INSERT TO public 
    WITH CHECK (true);
CREATE POLICY read_user_sessions ON user_sessions FOR SELECT TO public 
    USING (true);
CREATE POLICY update_user_sessions ON user_sessions FOR UPDATE TO public 
    USING (true);

