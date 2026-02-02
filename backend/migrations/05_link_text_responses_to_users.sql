-- Add user_session_id to text_responses table to link to individual users
ALTER TABLE text_responses 
    ADD COLUMN IF NOT EXISTS user_session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE;

-- Create index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_text_responses_session ON text_responses(user_session_id);

-- Note: Existing text_responses rows will have user_session_id as NULL
-- This allows old aggregate data to coexist with new individual data

