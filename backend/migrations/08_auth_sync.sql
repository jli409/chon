-- Sync Supabase auth users into user_sessions and email_verifications
-- Uses auth.users id as verification_token; user_sessions no longer stores it

-- Allow questionnaire_type to be nullable for auth-created records
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
