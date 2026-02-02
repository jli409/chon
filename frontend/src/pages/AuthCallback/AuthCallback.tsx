import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.ts';

const AuthCallback = () => {
  const [message, setMessage] = useState('Redirecting...');

  useEffect(() => {
    const finalize = async () => {
      const url = new URL(window.location.href);
      const authCode = url.searchParams.get('code');
      const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (!authCode && !(accessToken && refreshToken)) {
        setMessage('Link expired.');
        return;
      }

      if (authCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(authCode);
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

      window.location.replace('/personality-test/questionnaire');
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
