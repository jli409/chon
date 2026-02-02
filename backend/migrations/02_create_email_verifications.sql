-- Create email_verifications table for email verification feature
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

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_verification_token ON email_verifications(verification_token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_session_token ON email_verifications(session_token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

-- Enable RLS (Row Level Security)
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY insert_email_verifications ON email_verifications FOR INSERT TO public 
    WITH CHECK (true);
CREATE POLICY read_email_verifications ON email_verifications FOR SELECT TO public 
    USING (true);
CREATE POLICY update_email_verifications ON email_verifications FOR UPDATE TO public 
    USING (true);

-- Create function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_verifications_modified()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
        NEW.verified_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Create trigger
CREATE TRIGGER update_email_verifications_verified_at
BEFORE UPDATE ON email_verifications
FOR EACH ROW
WHEN (NEW.is_verified IS TRUE AND OLD.is_verified IS FALSE)
EXECUTE PROCEDURE update_email_verifications_modified();

