import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import { getApiBaseUrl } from '../../config/apiBaseUrl.ts';
import userSessionApi from '../../api/userSession.ts';
import { supabase } from '../../lib/supabaseClient.ts';
import {
  sendSupabaseOtpVerificationLink,
  sendVerificationEmail,
  syncEmailVerificationWithChonBackend,
  verifyEmailToken,
} from '../../services/emailVerification.ts';
import { parseChonSessionIdFromSearch } from '../../utils/chonSessionUrl.ts';
import './AccountEmailVerification.css';

type SupabaseOtpType = 'signup' | 'email' | 'magiclink' | 'recovery' | 'invite' | 'email_change';

const ALLOWED_SUPABASE_OTP_TYPES = new Set<SupabaseOtpType>([
  'signup',
  'email',
  'magiclink',
  'recovery',
  'invite',
  'email_change',
]);

interface AccountEmailVerificationProps {
  onVerified: (email: string) => void;
  onBack?: () => void;
}

const normalizeEmail = (value?: string | null) => (value || '').trim().toLowerCase();

const readStoredEmail = () =>
  normalizeEmail(
    localStorage.getItem('verifiedEmail') ||
      localStorage.getItem('userSessionEmail') ||
      localStorage.getItem('pendingVerificationEmail')
  );

const AccountEmailVerification = ({ onVerified, onBack }: AccountEmailVerificationProps) => {
  const { language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const verifyLinkHandledRef = useRef(false);
  const authHandoffHandledRef = useRef(false);

  const [userEmail, setUserEmail] = useState(readStoredEmail);
  const [emailError, setEmailError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationReadyToContinue, setVerificationReadyToContinue] = useState(false);
  const [pendingSupabaseTokenHash, setPendingSupabaseTokenHash] = useState<string | null>(null);
  const [pendingSupabaseOtpType, setPendingSupabaseOtpType] = useState<SupabaseOtpType>('email');
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');

  const finishVerified = useCallback(
    (email: string) => {
      const normalized = normalizeEmail(email);
      if (normalized) {
        localStorage.setItem('emailVerified', 'true');
        localStorage.setItem('verifiedEmail', normalized);
        localStorage.setItem('userSessionEmail', normalized);
      }
      onVerified(normalized || email);
    },
    [onVerified]
  );

  const showVerifiedContinueState = useCallback(() => {
    const storedEmail = readStoredEmail();
    if (storedEmail) {
      setUserEmail(storedEmail);
    }
    setPendingSupabaseTokenHash(null);
    setVerificationSent(true);
    setVerificationReadyToContinue(true);
    setEmailError('');
    setVerificationMessage(
      language === 'en'
        ? 'Email verified. Continue when you are ready to create your account.'
        : '邮箱验证完成。准备好后继续创建账号。'
    );
  }, [language]);

  useEffect(() => {
    const sid = parseChonSessionIdFromSearch(searchParams);
    if (sid) {
      localStorage.setItem('userSessionId', sid);
    }
  }, [searchParams]);

  useEffect(() => {
    const token = searchParams.get('verify');
    if (!token || verifyLinkHandledRef.current) {
      return;
    }
    verifyLinkHandledRef.current = true;

    void (async () => {
      const result = await verifyEmailToken(token);
      if (!result.success) {
        verifyLinkHandledRef.current = false;
        setEmailError(result.message);
        return;
      }
      const verified = normalizeEmail(result.email) || readStoredEmail();
      if (verified) {
        setUserEmail(verified);
      }
      const next = new URLSearchParams(searchParams);
      next.delete('verify');
      setSearchParams(next, { replace: true });
      showVerifiedContinueState();
    })();
  }, [searchParams, setSearchParams, showVerifiedContinueState]);

  useEffect(() => {
    if (authHandoffHandledRef.current) {
      return;
    }
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const oauthCode =
      url.searchParams.get('error') ||
      hashParams.get('error') ||
      hashParams.get('error_code');
    const oauthDesc =
      url.searchParams.get('error_description') ||
      hashParams.get('error_description');
    const friendlyOauthMessage =
      oauthCode === 'access_denied' || oauthCode === 'otp_expired'
        ? language === 'en'
          ? 'This verification link is invalid or has expired. Please go back and send a new email.'
          : '此验证链接无效或已过期，请返回并重新发送邮件。'
        : '';
    const oauthMessage =
      friendlyOauthMessage ||
      (oauthCode || oauthDesc
        ? decodeURIComponent((oauthDesc || oauthCode || '').replace(/\+/g, ' '))
        : '');

    const authCode = url.searchParams.get('code');
    const tokenHash = url.searchParams.get('token_hash');
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const typeParam = (url.searchParams.get('type') || 'email').toLowerCase();
    const otpType = (ALLOWED_SUPABASE_OTP_TYPES.has(typeParam as SupabaseOtpType)
      ? typeParam
      : 'email') as SupabaseOtpType;
    const hasAuthParams =
      Boolean(authCode) ||
      Boolean(tokenHash) ||
      url.searchParams.get('type') === 'magiclink' ||
      window.location.hash.includes('access_token') ||
      Boolean(oauthCode) ||
      Boolean(oauthDesc);

    if (!hasAuthParams) {
      return;
    }
    authHandoffHandledRef.current = true;

    void (async () => {
      if (oauthMessage) {
        setPendingSupabaseTokenHash(null);
        setEmailError(oauthMessage);
        setVerificationReadyToContinue(false);
        setVerificationSent(true);
        setVerificationMessage('');
        url.searchParams.delete('error');
        url.searchParams.delete('error_description');
        url.searchParams.delete('error_code');
        const qs = url.searchParams.toString();
        window.history.replaceState(null, '', `${url.pathname}${qs ? `?${qs}` : ''}`);
        return;
      }

      if (authCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(authCode);
        if (error) {
          console.error('Supabase auth redirect error:', error);
        }
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          console.error('Supabase hash session error:', error);
        }
      } else if (tokenHash) {
        const storedEmail = readStoredEmail();
        if (storedEmail) {
          setUserEmail(storedEmail);
        }
        setPendingSupabaseTokenHash(tokenHash);
        setPendingSupabaseOtpType(otpType);
        setVerificationSent(true);
        setVerificationReadyToContinue(true);
        setVerificationMessage(
          language === 'en'
            ? 'Verification link received. Continue below to verify and create your account.'
            : '已收到验证链接。点击下方继续验证并创建账号。'
        );
        setEmailError('');
        url.searchParams.delete('code');
        url.searchParams.delete('type');
        url.searchParams.delete('token_hash');
        const qs = url.searchParams.toString();
        window.history.replaceState(null, '', `${url.pathname}${qs ? `?${qs}` : ''}`);
        return;
      }

      const shouldSyncChonDb =
        Boolean(authCode) ||
        Boolean(tokenHash) ||
        url.searchParams.get('type') === 'magiclink' ||
        window.location.hash.includes('access_token');
      if (shouldSyncChonDb) {
        const synced = await syncEmailVerificationWithChonBackend();
        if (!synced) {
          setEmailError(
            language === 'en'
              ? 'Could not sync email verification to the app server. Check your connection, then resend the verification email if needed.'
              : '无法将邮箱验证同步到应用服务器。请检查网络，必要时重新发送验证邮件。'
          );
        } else {
          const sessionEmail = normalizeEmail(
            (await supabase.auth.getSession()).data.session?.user?.email
          );
          if (sessionEmail) {
            setUserEmail(sessionEmail);
          }
          if (authCode || (accessToken && refreshToken)) {
            finishVerified(sessionEmail || readStoredEmail());
          } else {
            showVerifiedContinueState();
          }
        }
      }

      url.searchParams.delete('code');
      url.searchParams.delete('type');
      url.searchParams.delete('token_hash');
      const qs = url.searchParams.toString();
      window.history.replaceState(null, '', `${url.pathname}${qs ? `?${qs}` : ''}`);
    })();
  }, [finishVerified, language, showVerifiedContinueState]);

  const handleVerifiedContinue = async () => {
    if (pendingSupabaseTokenHash) {
      setIsSendingVerification(true);
      setEmailError('');
      try {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: pendingSupabaseTokenHash,
          type: pendingSupabaseOtpType,
        });
        if (error) {
          setPendingSupabaseTokenHash(null);
          setVerificationReadyToContinue(false);
          setVerificationSent(true);
          setVerificationMessage('');
          setEmailError(
            language === 'en'
              ? 'This verification link is invalid or has expired. Please go back and send a new email.'
              : '此验证链接无效或已过期，请返回并重新发送邮件。'
          );
          return;
        }

        setPendingSupabaseTokenHash(null);
        const synced = await syncEmailVerificationWithChonBackend();
        if (!synced) {
          setEmailError(
            language === 'en'
              ? 'Could not sync email verification to the app server. Check your connection, then resend the verification email if needed.'
              : '无法将邮箱验证同步到应用服务器。请检查网络，必要时重新发送验证邮件。'
          );
          return;
        }
      } finally {
        setIsSendingVerification(false);
      }
    }

    setVerificationReadyToContinue(false);
    setVerificationMessage('');
    finishVerified(userEmail || readStoredEmail());
  };

  const handleSendVerification = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = userEmail.trim().toLowerCase();

    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      setEmailError(
        language === 'en' ? 'Please enter a valid email address.' : '请输入有效的邮箱地址。'
      );
      return;
    }

    setEmailError('');
    setVerificationMessage('');
    setVerificationReadyToContinue(false);
    setPendingSupabaseTokenHash(null);
    setIsSendingVerification(true);

    try {
      const existsResponse = await fetch(`${getApiBaseUrl()}/user-accounts/exists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      if (!existsResponse.ok) {
        let detail = `Account check failed (${existsResponse.status})`;
        try {
          const errBody = (await existsResponse.json()) as { error?: string };
          if (typeof errBody?.error === 'string') {
            detail = errBody.error;
          }
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }
      const existsData = await existsResponse.json();
      const accountExists =
        existsData?.exists === true ||
        existsData?.exists === 'true' ||
        existsData?.exists === 1;
      if (accountExists) {
        setEmailError(
          language === 'en'
            ? 'This email already has an account. Please log in.'
            : '该邮箱已存在账号，请直接登录。'
        );
        return;
      }

      const userSessionId = localStorage.getItem('userSessionId');
      if (!userSessionId) {
        setEmailError(
          language === 'en'
            ? 'No test session found. Please complete the personality test first.'
            : '未找到测试会话，请先完成性格测试。'
        );
        return;
      }

      const sessionRow = await userSessionApi.getUserSession(userSessionId);
      if (sessionRow && typeof sessionRow === 'object') {
        const sessionVerified = Boolean(sessionRow.email_verified);
        const lockedEmail =
          typeof sessionRow.email === 'string' && sessionRow.email.trim()
            ? sessionRow.email.trim().toLowerCase()
            : '';
        if (sessionVerified) {
          localStorage.setItem('emailVerified', 'true');
          if (lockedEmail) {
            localStorage.setItem('userSessionEmail', lockedEmail);
            localStorage.setItem('verifiedEmail', lockedEmail);
            setUserEmail(lockedEmail);
          }
          setEmailError('');
          setVerificationMessage('');
          showVerifiedContinueState();
          return;
        }
      }

      const emailPersisted = await userSessionApi.patchUserSessionEmail(userSessionId, normalizedEmail);
      if (!emailPersisted) {
        setEmailError(
          language === 'en'
            ? 'Could not save your email for this session. Please try again.'
            : '无法保存邮箱，请重试。'
        );
        return;
      }
      localStorage.setItem('userSessionEmail', normalizedEmail);

      const qType = localStorage.getItem('userSessionQuestionnaireType') || 'mother';
      const supabase = await sendSupabaseOtpVerificationLink(normalizedEmail, userSessionId);
      if (!supabase.success) {
        const postmark = await sendVerificationEmail(
          normalizedEmail,
          language.toLowerCase().startsWith('zh') ? 'zh' : 'en',
          qType,
          userSessionId
        );
        if (!postmark.success) {
          throw new Error(
            [supabase.message, postmark.message].filter(Boolean).join(' — ') ||
              'Could not send verification email.'
          );
        }
      }

      localStorage.setItem('pendingVerificationEmail', normalizedEmail);
      setVerificationSent(true);
      setVerificationMessage(
        language === 'en'
          ? supabase.success
            ? 'Please check inbox for link to continue creating your account.'
            : 'Verification link sent. Please check your inbox and click the link to continue creating your account.'
          : supabase.success
            ? '请查收邮箱中的链接以继续创建账号。'
            : '验证链接已发送。请查收邮件并点击链接继续创建账号。'
      );
    } catch (error) {
      console.error('Error sending verification email:', error);
      const detail =
        error instanceof Error && error.message
          ? error.message
          : language === 'en'
            ? 'Failed to send verification email. Please try again.'
            : '发送验证邮件失败，请重试。';
      setEmailError(detail);
    } finally {
      setIsSendingVerification(false);
    }
  };

  return (
    <div className="email-verification-page" lang={language}>
      <div className="email-verification-content">
        <h2 className="email-verification-title">
          {language === 'en' ? 'Email Verification' : '邮箱验证'}
        </h2>
        <p className="email-verification-description">
          {verificationReadyToContinue && pendingSupabaseTokenHash
            ? language === 'en'
              ? 'Your email link is ready. Continue below to verify and create your account.'
              : '您的邮箱链接已就绪。点击下方继续验证并创建账号。'
            : verificationReadyToContinue
              ? language === 'en'
                ? 'Your email is verified. Use the button below to create your account.'
                : '您的邮箱已验证。点击下方按钮创建账号。'
              : language === 'en'
                ? 'Please enter your professional email to verify your identity before creating your account.'
                : '创建账号前，请输入您的职业邮箱以验证身份。'}
        </p>

        <div className="text-input-container">
          <input
            type="email"
            className="text-answer-input"
            value={userEmail}
            onChange={(e) => {
              setUserEmail(e.target.value);
              setEmailError('');
              setPendingSupabaseTokenHash(null);
              setVerificationReadyToContinue(false);
              setVerificationSent(false);
              setVerificationMessage('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void handleSendVerification();
              }
            }}
            placeholder={language === 'en' ? 'your.email@company.com' : '您的邮箱@公司.com'}
            disabled={verificationReadyToContinue}
          />
        </div>

        {emailError && <div className="email-error-text">{emailError}</div>}

        {verificationMessage && (
          <div className="email-verification-status">{verificationMessage}</div>
        )}

        {!verificationReadyToContinue && (
          <button
            className="email-continue-button"
            onClick={() => void handleSendVerification()}
            lang={language}
            type="button"
            disabled={isSendingVerification}
          >
            <span>
              {isSendingVerification
                ? language === 'en'
                  ? 'SENDING...'
                  : '发送中...'
                : verificationSent
                  ? language === 'en'
                    ? 'RESEND LINK'
                    : '重新发送'
                  : language === 'en'
                    ? 'CONTINUE'
                    : '继续'}
            </span>
            <span className="continue-arrow">→</span>
          </button>
        )}

        {verificationReadyToContinue && (
          <button
            className="email-continue-button"
            onClick={() => void handleVerifiedContinue()}
            lang={language}
            type="button"
            disabled={isSendingVerification}
          >
            <span>
              {isSendingVerification
                ? language === 'en'
                  ? 'VERIFYING...'
                  : '验证中...'
                : language === 'en'
                  ? 'CONTINUE'
                  : '继续'}
            </span>
            <span className="continue-arrow">→</span>
          </button>
        )}

        {onBack && (
          <button type="button" className="email-verification-back" onClick={onBack}>
            {language === 'en' ? '← Back to Results' : '← 返回结果'}
          </button>
        )}
      </div>
    </div>
  );
};

export default AccountEmailVerification;
