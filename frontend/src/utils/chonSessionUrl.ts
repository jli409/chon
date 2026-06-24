/** CHON `user_sessions.id` in email links (`?sid=`) — carry through Postmark + Supabase redirects. */
export const CHON_USER_SESSION_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const parseChonSessionIdFromSearch = (sp: URLSearchParams): string | null => {
  const raw = sp.get('sid')?.trim();
  if (!raw || !CHON_USER_SESSION_UUID_RE.test(raw)) {
    return null;
  }
  return raw;
};
