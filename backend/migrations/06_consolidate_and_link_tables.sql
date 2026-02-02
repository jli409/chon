-- Consolidate text_responses into question_responses and link email_verifications to user_sessions

-- 1. Add columns to question_responses to support text responses
ALTER TABLE question_responses 
    ADD COLUMN IF NOT EXISTS response_text TEXT,
    ADD COLUMN IF NOT EXISTS is_text_response BOOLEAN DEFAULT FALSE;

-- 2. Create view for compatibility (so old queries still work)
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

-- 3. Add user_session_id to email_verifications
ALTER TABLE email_verifications
    ADD COLUMN IF NOT EXISTS user_session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_verifications_session ON email_verifications(user_session_id);

-- 4. Ensure intro_choice is properly linked in user_sessions
-- (Already exists as a column, no migration needed)

-- 5. Update the question_responses unique constraint to handle both types
ALTER TABLE question_responses 
    DROP CONSTRAINT IF EXISTS question_responses_questionnaire_type_question_id_response_key;

-- Note: We keep both question_responses (for all response types) and 
-- the text_responses view (for backward compatibility)

