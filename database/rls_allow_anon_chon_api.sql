-- =============================================================================
-- RLS: allow CHON Flask API to read/write via Supabase anon key (SUPABASE_KEY)
-- =============================================================================
-- Symptom: 42501 "new row violates row-level security policy for table tag_scores"
-- Cause: RLS enabled on a table but no (or incomplete) policy for role ``anon``.
--
-- Run in Supabase: SQL Editor → New query → paste → Run.
-- Safe to re-run: drops CHON-named policies first, then recreates.
--
-- Security: same model as DATABASE_SCHEMA.md (public API writes through anon key).
-- Lock down in production if you move writes to Edge Functions + service_role only.
-- =============================================================================

-- --- tag_scores (POST /tag-scores upsert) ---
ALTER TABLE public.tag_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chon_anon_all_tag_scores" ON public.tag_scores;
CREATE POLICY "chon_anon_all_tag_scores" ON public.tag_scores
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "chon_authenticated_all_tag_scores" ON public.tag_scores;
CREATE POLICY "chon_authenticated_all_tag_scores" ON public.tag_scores
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- --- tag_statistics (POST /tag-statistics upsert) ---
ALTER TABLE public.tag_statistics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chon_anon_all_tag_statistics" ON public.tag_statistics;
CREATE POLICY "chon_anon_all_tag_statistics" ON public.tag_statistics
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "chon_authenticated_all_tag_statistics" ON public.tag_statistics;
CREATE POLICY "chon_authenticated_all_tag_statistics" ON public.tag_statistics
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- --- character_matches (delete + insert on save) ---
ALTER TABLE public.character_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chon_anon_all_character_matches" ON public.character_matches;
CREATE POLICY "chon_anon_all_character_matches" ON public.character_matches
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "chon_authenticated_all_character_matches" ON public.character_matches;
CREATE POLICY "chon_authenticated_all_character_matches" ON public.character_matches
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- --- email_verifications (GET /email/verify updates is_verified / verified_at; send/resend insert) ---
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chon_anon_all_email_verifications" ON public.email_verifications;
CREATE POLICY "chon_anon_all_email_verifications" ON public.email_verifications
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "chon_authenticated_all_email_verifications" ON public.email_verifications;
CREATE POLICY "chon_authenticated_all_email_verifications" ON public.email_verifications
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- --- user_sessions (PATCH email; verify sets email_verified) ---
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chon_anon_all_user_sessions" ON public.user_sessions;
CREATE POLICY "chon_anon_all_user_sessions" ON public.user_sessions
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "chon_authenticated_all_user_sessions" ON public.user_sessions;
CREATE POLICY "chon_authenticated_all_user_sessions" ON public.user_sessions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
