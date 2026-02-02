-- Create table for user accounts linked to user sessions
CREATE TABLE IF NOT EXISTS user_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_accounts_session ON user_accounts(user_session_id);
CREATE INDEX IF NOT EXISTS idx_user_accounts_email ON user_accounts(email);

-- Enable RLS
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies (allow public access for now, can restrict later)
CREATE POLICY insert_user_accounts ON user_accounts FOR INSERT TO public 
    WITH CHECK (true);
CREATE POLICY read_user_accounts ON user_accounts FOR SELECT TO public 
    USING (true);
CREATE POLICY update_user_accounts ON user_accounts FOR UPDATE TO public 
    USING (true);
