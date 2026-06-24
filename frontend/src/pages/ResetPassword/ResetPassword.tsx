import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import { supabase } from '../../lib/supabaseClient.ts';
import { getApiBaseUrl } from '../../config/apiBaseUrl.ts';
import {
  applyLoginSnapshotPayload,
  type ChonLoginSnapshotPayload
} from '../../utils/loginSnapshotStorage.ts';
import './ResetPassword.css';
import '../Login/Login.css';

const ResetPassword = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const init = async () => {
      const url = new URL(window.location.href);
      const authCode = url.searchParams.get('code');
      if (authCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(authCode);
        if (error) {
          setMessage(language === 'en' ? 'Reset link is invalid or expired.' : '重置链接无效或已过期。');
          return;
        }
      } else {
        const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          if (error) {
            setMessage(language === 'en' ? 'Reset link is invalid or expired.' : '重置链接无效或已过期。');
            return;
          }
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setMessage(language === 'en' ? 'Please request a new reset link.' : '请重新申请重置链接。');
        return;
      }

      setIsSessionReady(true);
    };

    void init();
  }, [language]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const nextErrors = { password: '', confirmPassword: '' };
    let isValid = true;

    if (!formData.password) {
      nextErrors.password = language === 'en' ? 'Password is required' : '请输入密码';
      isValid = false;
    } else if (formData.password.length < 8) {
      nextErrors.password = language === 'en' ? 'Password must be at least 8 characters' : '密码至少需要8个字符';
      isValid = false;
    }

    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = language === 'en' ? 'Please confirm your password' : '请确认您的密码';
      isValid = false;
    } else if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = language === 'en' ? 'Passwords do not match' : '密码不匹配';
      isValid = false;
    }

    setErrors(nextErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setMessage('');

    const { data: sessionWrap } = await supabase.auth.getSession();
    const userEmail = sessionWrap.session?.user?.email?.trim().toLowerCase();
    if (!userEmail) {
      setMessage(language === 'en' ? 'Missing email on session. Please try the reset link again.' : '会话缺少邮箱，请重新打开重置链接。');
      setIsSubmitting(false);
      return;
    }

    const base = getApiBaseUrl();
    const password = formData.password;

    // If confirmation matches and this is already the current CHON password, skip changing — user can log in as-is.
    const preLoginRes = await fetch(`${base}/user-accounts/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password })
    });
    const preLoginRaw = await preLoginRes.text();
    let preLoginJson: ChonLoginSnapshotPayload = {};
    try {
      preLoginJson = preLoginRaw.trim() ? (JSON.parse(preLoginRaw) as ChonLoginSnapshotPayload) : {};
    } catch {
      preLoginJson = {};
    }

    if (preLoginRes.status === 200 && preLoginJson.success === true) {
      let prev: Record<string, unknown> = {};
      try {
        prev = JSON.parse(localStorage.getItem('userAccount') || '{}') as Record<string, unknown>;
      } catch {
        prev = {};
      }
      localStorage.setItem(
        'userAccount',
        JSON.stringify({
          ...prev,
          email: userEmail,
          createdAt: (prev.createdAt as string) || new Date().toISOString()
        })
      );
      applyLoginSnapshotPayload(preLoginJson, userEmail);
      setMessage(
        language === 'en'
          ? 'The password you have is correct!'
          : '您输入的密码正确，可与当前账号密码正常登录。'
      );
      setIsSubmitting(false);
      await supabase.auth.signOut();
      setTimeout(() => navigate('/login'), 1500);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(language === 'en' ? 'Failed to reset password. Please try again.' : '重置密码失败，请重试。');
      setIsSubmitting(false);
      return;
    }

    let { data } = await supabase.auth.getSession();
    let accessToken = data.session?.access_token;
    if (!accessToken) {
      const refreshed = await supabase.auth.refreshSession();
      accessToken = refreshed.data.session?.access_token;
      data = refreshed.data;
    }

    // CHON: sync user_accounts.password_hash, then verify with POST /user-accounts/login (same check as Login).
    if (!accessToken) {
      setMessage(
        language === 'en'
          ? 'Session expired. Please open the reset link again.'
          : '会话已过期，请重新打开重置邮件中的链接。'
      );
      setIsSubmitting(false);
      return;
    }

    const syncRes = await fetch(`${base}/user-accounts/password`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ password })
    });
    const syncBody = (await syncRes.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      code?: string;
    };

    if (syncRes.status === 404 && syncBody.code === 'NO_CHON_ACCOUNT') {
      setMessage(
        language === 'en'
          ? 'Password updated for your email. No CHON site account was found — register after the questionnaire to use Login here.'
          : '邮箱密码已更新，但未找到本站账号——请先完成问卷并注册后再使用本站登录。'
      );
      setIsSubmitting(false);
      await supabase.auth.signOut();
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    if (!syncRes.ok || syncBody.success !== true) {
      setMessage(
        language === 'en'
          ? `Could not sync password to the app server (${syncBody.error || syncRes.status}). Your email password may have changed; try again or contact support.`
          : `无法同步到应用服务器（${syncBody.error || syncRes.status}）。请重试或联系支持。`
      );
      setIsSubmitting(false);
      return;
    }

    const loginRes = await fetch(`${base}/user-accounts/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password })
    });
    const loginRaw = await loginRes.text();
    let loginJson: ChonLoginSnapshotPayload = {};
    try {
      loginJson = loginRaw.trim() ? (JSON.parse(loginRaw) as ChonLoginSnapshotPayload) : {};
    } catch {
      loginJson = {};
    }
    if (loginRes.status !== 200 || loginJson.success !== true) {
      setMessage(
        language === 'en'
          ? loginJson.error ||
              'Password was synced but sign-in check failed. Please try submitting again.'
          : loginJson.error || '密码已同步但登录校验失败，请再试一次提交。'
      );
      setIsSubmitting(false);
      return;
    }

    if (userEmail) {
      let prev: Record<string, unknown> = {};
      try {
        prev = JSON.parse(localStorage.getItem('userAccount') || '{}') as Record<string, unknown>;
      } catch {
        prev = {};
      }
      localStorage.setItem(
        'userAccount',
        JSON.stringify({
          ...prev,
          email: userEmail,
          createdAt: (prev.createdAt as string) || new Date().toISOString()
        })
      );
      localStorage.setItem('userSessionEmail', userEmail);
    }

    applyLoginSnapshotPayload(loginJson, userEmail);

    await supabase.auth.signOut();
    setMessage(language === 'en' ? 'Password updated. Redirecting...' : '密码已更新，正在跳转...');
    setIsSubmitting(false);
    setTimeout(() => navigate('/login'), 1200);
  };

  return (
    <div className="login-container reset-password-container" lang={language}>
      <div className="molecule-background"></div>
      <div className="hexagon-pattern"></div>

      <h1 lang={language}>
        {language === 'en' ? 'Reset Password' : '重置密码'}
      </h1>

      <div className="login-content reset-password-content" lang={language}>
        {message && <p className="reset-password-message">{message}</p>}

        <form className="registration-form reset-password-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">
              {language === 'en' ? 'New Password' : '新密码'}
              <span className="required">*</span>
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={language === 'en' ? 'At least 8 characters' : '至少8个字符'}
              className={errors.password ? 'error' : ''}
              disabled={!isSessionReady}
            />
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              {language === 'en' ? 'Confirm Password' : '确认密码'}
              <span className="required">*</span>
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder={language === 'en' ? 'Re-enter your password' : '请再次输入您的密码'}
              className={errors.confirmPassword ? 'error' : ''}
              disabled={!isSessionReady}
            />
            {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
          </div>

          <button type="submit" className="submit-button" disabled={!isSessionReady || isSubmitting}>
            {isSubmitting
              ? (language === 'en' ? 'Updating...' : '更新中...')
              : (language === 'en' ? 'Continue' : '继续')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
