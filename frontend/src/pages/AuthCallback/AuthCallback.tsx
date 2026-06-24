import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.ts';
import { syncEmailVerificationWithChonBackend } from '../../services/emailVerification.ts';
import { parseChonSessionIdFromSearch } from '../../utils/chonSessionUrl.ts';

const AuthCallback = () => {
  const [message, setMessage] = useState('Redirecting...');

  useEffect(() => {
    const finalize = async () => {
      const url = new URL(window.location.href);
      const authCode = url.searchParams.get('code');
      const tokenHash = url.searchParams.get('token_hash');
      const typeParam = (url.searchParams.get('type') || 'email').toLowerCase();
      const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (!authCode && !tokenHash && !(accessToken && refreshToken)) {
        setMessage('Link expired.');
        return;
      }

      const sidKeep = parseChonSessionIdFromSearch(url.searchParams);
      if (sidKeep) {
        localStorage.setItem('userSessionId', sidKeep);
      }

      if (authCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(authCode);
        if (error) {
          setMessage('Link expired.');
          return;
        }
      } else if (tokenHash) {
        const allowed = new Set(['signup', 'email', 'magiclink', 'recovery', 'invite', 'email_change']);
        const otpType = (allowed.has(typeParam) ? typeParam : 'email') as
          | 'signup'
          | 'email'
          | 'magiclink'
          | 'recovery'
          | 'invite'
          | 'email_change';
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType
        });
        if (error) {
          setMessage('Link expired.');
          return;
        }
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        if (error) {
          setMessage('Link expired.');
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setMessage('Link expired.');
        return;
      }

      const synced = await syncEmailVerificationWithChonBackend();
      if (!synced) {
        setMessage(
          'Signed in, but the app could not record your email verification. Return to account creation, resend the email, or try again.'
        );
        return;
      }

      const verifiedEmail = data.session.user.email?.trim().toLowerCase();
      if (verifiedEmail) {
        localStorage.setItem('verifiedEmail', verifiedEmail);
        localStorage.setItem('userSessionEmail', verifiedEmail);
      }

      window.location.replace(
        sidKeep
          ? `/login?sid=${encodeURIComponent(sidKeep)}&mode=register`
          : '/login?mode=register'
      );
    };

    void finalize();
  }, []);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      {message}
    </div>
  );
};

export default AuthCallback;
