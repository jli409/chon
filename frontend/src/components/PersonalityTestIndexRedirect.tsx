import { Navigate, useLocation } from 'react-router-dom';

/**
 * `/personality-test` → intro by default.
 * Legacy verify/auth query params are forwarded to `/login` for account creation.
 */
export default function PersonalityTestIndexRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const hash = location.hash || '';
  const hasVerify = Boolean(params.get('verify'));
  const hasSupabaseHandoff =
    Boolean(params.get('code')) ||
    Boolean(params.get('token_hash')) ||
    params.get('type') === 'magiclink' ||
    hash.includes('access_token') ||
    hash.includes('error=');
  const target =
    hasVerify || hasSupabaseHandoff
      ? '/auth/callback'
      : '/personality-test/intro';
  const to = `${target}${location.search}${hash}`;
  return <Navigate to={to} replace />;
}
