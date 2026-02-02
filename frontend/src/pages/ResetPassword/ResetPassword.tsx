import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import { supabase } from '../../lib/supabaseClient.ts';
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

    const { error } = await supabase.auth.updateUser({ password: formData.password });
    if (error) {
      setMessage(language === 'en' ? 'Failed to reset password. Please try again.' : '重置密码失败，请重试。');
      setIsSubmitting(false);
      return;
    }

    const { data } = await supabase.auth.getSession();
    const userEmail = data.session?.user?.email;
    if (userEmail) {
      localStorage.setItem('userAccount', JSON.stringify({
        email: userEmail,
        password: 'supabase',
        createdAt: new Date().toISOString()
      }));
    }

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
