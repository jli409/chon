import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import { calculateTagStats, toEnglishTag } from '../../utils/tagUtils';
import { sortCharactersByMatch } from '../../utils/characterMatching';
import { questionnaires, type QuestionnaireType } from '../PersonalityTest/questionnaires.ts';
import { supabase } from '../../lib/supabaseClient.ts';
import AccountEmailVerification from '../../components/AccountEmailVerification/AccountEmailVerification.tsx';
import { getApiBaseUrl } from '../../config/apiBaseUrl.ts';
import {
  applyLoginSnapshotPayload,
  type ChonLoginSnapshotPayload
} from '../../utils/loginSnapshotStorage.ts';
import odinImage from '../../assets/characters/odin.jpg';
import wukongImage from '../../assets/characters/wukong.jpg';
import prometheusImage from '../../assets/characters/prometheus.jpg';
import nuwaImage from '../../assets/characters/nuwa.jpg';
import athenaImage from '../../assets/characters/athena.jpg';
import venusImage from '../../assets/characters/venus.jpg';
import './Login.css';

function interpretChonLoginResponse(
  res: Response,
  raw: string,
  defaultInvalid: string
): { type: 'ok'; data: ChonLoginSnapshotPayload } | { type: 'auth'; message: string } | { type: 'bad_response' } {
  let data: unknown;
  try {
    data = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return { type: 'bad_response' };
  }
  if (!data || typeof data !== 'object') {
    return { type: 'bad_response' };
  }
  const o = data as Record<string, unknown>;
  if (res.ok && res.status === 200 && o.success === true) {
    return { type: 'ok', data: o as ChonLoginSnapshotPayload };
  }
  const serverErr = typeof o.error === 'string' ? o.error.trim() : '';
  return { type: 'auth', message: serverErr || defaultInvalid };
}

const Login = () => {
  const { language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const locationState = (location.state as { flow?: string; mode?: string }) || {};
  const wantsCreateAccount =
    locationState.flow === 'create-account' ||
    locationState.mode === 'register' ||
    searchParams.get('mode') === 'register' ||
    Boolean(searchParams.get('verify'));
  const [accountPhase, setAccountPhase] = useState<'verify' | 'register'>(() =>
    localStorage.getItem('emailVerified') === 'true' ? 'register' : 'verify'
  );
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  /** Inline API error (replaces alert) so failed login stays on the form. */
  const [loginSubmitError, setLoginSubmitError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mostFittedCharacter, setMostFittedCharacter] = useState<{
    id: string;
    name: { en: string; zh: string };
    image: string;
  } | null>(null);
  
  // Forgot password flow states
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'none' | 'email' | 'sent'>('none');
  const [forgotPasswordData, setForgotPasswordData] = useState({
    email: ''
  });
  const [forgotPasswordErrors, setForgotPasswordErrors] = useState({
    email: ''
  });

  const resolveTagStats = () => {
    const tagStatsRaw = localStorage.getItem('tagStats');
    if (tagStatsRaw) {
      try {
        return JSON.parse(tagStatsRaw) as Record<string, { scorePercentage?: number }>;
      } catch (error) {
        console.error('Error parsing tagStats from localStorage:', error);
      }
    }

    const tagScoresRaw = localStorage.getItem('tagScores');
    if (tagScoresRaw) {
      try {
        const tagScores = JSON.parse(tagScoresRaw) as Record<string, number[]>;
        return calculateTagStats(tagScores) as Record<string, { scorePercentage?: number }>;
      } catch (error) {
        console.error('Error parsing tagScores from localStorage:', error);
      }
    }

    return null;
  };

  const normalizeEmail = (value?: string | null) => (value || '').trim().toLowerCase();

  const getVerifiedEmail = () => {
    return normalizeEmail(
      localStorage.getItem('verifiedEmail') ||
      localStorage.getItem('userSessionEmail') ||
      localStorage.getItem('pendingVerificationEmail')
    );
  };

  const getAccountEmail = () => {
    const accountRaw = localStorage.getItem('userAccount');
    if (!accountRaw) return '';
    try {
      const account = JSON.parse(accountRaw) as { email?: string };
      return normalizeEmail(account.email);
    } catch (error) {
      console.error('Error parsing userAccount from localStorage:', error);
      return '';
    }
  };
  const verifiedEmailNormalized = getVerifiedEmail();
  const isRegisterMode = wantsCreateAccount && accountPhase === 'register';
  const isVerifyMode = wantsCreateAccount && accountPhase === 'verify';
  const shouldHideEmailField = isRegisterMode && Boolean(verifiedEmailNormalized);

  // Check if user is logged in and get most fitted character
  useEffect(() => {
    const checkLoginStatus = async () => {
      const hasAccount = localStorage.getItem('userAccount');
      const tagStats = resolveTagStats();
      const hasResults = Boolean(tagStats);
      const isAuthenticated = Boolean(hasAccount);
      
      if (isAuthenticated && hasResults) {
        setIsLoggedIn(true);
        
        // Get the most fitted character from results
        const cardsData = [
          {
            id: 'odin',
            name: { en: 'Odin', zh: '奥丁' },
            image: odinImage,
            tagRanges: {
              selfAwareness: [80, 100] as [number, number],
              dedication: [20, 60] as [number, number],
              socialIntelligence: [30, 60] as [number, number],
              emotionalRegulation: [40, 60] as [number, number],
              objectivity: [60, 80] as [number, number],
              coreEndurance: [40, 60] as [number, number]
            }
          },
          {
            id: 'wukong',
            name: { en: 'Wukong', zh: '大圣' },
            image: wukongImage,
            tagRanges: {
              selfAwareness: [40, 60] as [number, number],
              dedication: [40, 60] as [number, number],
              socialIntelligence: [40, 70] as [number, number],
              emotionalRegulation: [80, 100] as [number, number],
              objectivity: [40, 60] as [number, number],
              coreEndurance: [40, 60] as [number, number]
            }
          },
          {
            id: 'prometheus',
            name: { en: 'Prometheus', zh: '普罗米修斯' },
            image: prometheusImage,
            tagRanges: {
              selfAwareness: [30, 60] as [number, number],
              dedication: [80, 100] as [number, number],
              socialIntelligence: [30, 60] as [number, number],
              emotionalRegulation: [30, 50] as [number, number],
              objectivity: [30, 70] as [number, number],
              coreEndurance: [60, 80] as [number, number]
            }
          },
          {
            id: 'nuwa',
            name: { en: 'Nüwa', zh: '女娲' },
            image: nuwaImage,
            tagRanges: {
              selfAwareness: [0, 40] as [number, number],
              dedication: [50, 80] as [number, number],
              socialIntelligence: [40, 60] as [number, number],
              emotionalRegulation: [60, 80] as [number, number],
              objectivity: [40, 60] as [number, number],
              coreEndurance: [80, 100] as [number, number]
            }
          },
          {
            id: 'athena',
            name: { en: 'Athena', zh: '雅典娜' },
            image: athenaImage,
            tagRanges: {
              selfAwareness: [60, 80] as [number, number],
              dedication: [0, 40] as [number, number],
              socialIntelligence: [50, 70] as [number, number],
              emotionalRegulation: [40, 60] as [number, number],
              objectivity: [70, 100] as [number, number],
              coreEndurance: [40, 60] as [number, number]
            }
          },
          {
            id: 'venus',
            name: { en: 'Venus', zh: '维纳斯' },
            image: venusImage,
            tagRanges: {
              selfAwareness: [60, 80] as [number, number],
              dedication: [40, 60] as [number, number],
              socialIntelligence: [80, 100] as [number, number],
              emotionalRegulation: [40, 70] as [number, number],
              objectivity: [30, 60] as [number, number],
              coreEndurance: [20, 50] as [number, number]
            }
          }
        ];

        // Calculate user scores and find best match using same logic as Results
        const userScores: Record<string, number> = {};
        Object.keys(tagStats || {}).forEach(tag => {
          if (tagStats?.[tag] && typeof tagStats[tag].scorePercentage === 'number') {
            const engKey = toEnglishTag(tag);
            if (engKey) {
              userScores[engKey] = tagStats[tag].scorePercentage as number;
            }
          }
        });

        const otherTags = ['selfAwareness', 'dedication', 'socialIntelligence', 'emotionalRegulation', 'objectivity'];
        const validScores = otherTags.map(tag => userScores[tag]).filter(v => typeof v === 'number');
        if (validScores.length === 5) {
          const avg = validScores.reduce((a, b) => a + b, 0) / 5;
          const coreStat = tagStats?.['核心耐力'];
          if (coreStat && typeof coreStat.scorePercentage === 'number' && !isNaN(coreStat.scorePercentage)) {
            let adjustedCore = coreStat.scorePercentage;
            if (avg > 60) {
              adjustedCore += (avg - 60);
            }
            userScores['coreEndurance'] = Math.min(100, Math.max(0, adjustedCore));
          }
        }

        const resolveQuestion25Answer = () => {
          const savedAnswers = localStorage.getItem('chon_personality_answers');
          if (savedAnswers) {
            try {
              const answers = JSON.parse(savedAnswers);
              if (answers && typeof answers === 'object') {
                const savedQuestionnaireType = (localStorage.getItem('userSessionQuestionnaireType') ||
                  localStorage.getItem('activeQuestionnaire') ||
                  'mother') as QuestionnaireType;
                const question25 = questionnaires[savedQuestionnaireType]?.questions.find(q => q.unifiedId === 25);
                if (question25 && answers[question25.id]) {
                  return answers[question25.id] as string;
                }
              }
            } catch (e) {
              console.error('Error parsing answers:', e);
            }
          }
          return undefined;
        };

        const question25Answer = resolveQuestion25Answer();
        const sortedCards = sortCharactersByMatch(userScores, cardsData, question25Answer);
        setMostFittedCharacter(sortedCards[0]);
      } else {
        setIsLoggedIn(false);
        setMostFittedCharacter(null);
      }
    };

    void checkLoginStatus();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void checkLoginStatus();
    });

    const handleStorageChange = (e: StorageEvent) => {
      if (['userAccount', 'tagStats'].includes(e.key || '')) {
        void checkLoginStatus();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    if (loginSubmitError) {
      setLoginSubmitError('');
    }
  };

  useEffect(() => {
    if (shouldHideEmailField && verifiedEmailNormalized) {
      setFormData(prev => ({
        ...prev,
        email: verifiedEmailNormalized
      }));
    }
  }, [shouldHideEmailField, verifiedEmailNormalized]);

  const validateForm = () => {
    const newErrors = {
      email: '',
      password: '',
      confirmPassword: ''
    };
    let isValid = true;
    const verifiedEmail = verifiedEmailNormalized;

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!shouldHideEmailField) {
      if (!formData.email) {
        newErrors.email = language === 'en' ? 'Email is required' : '电子邮件为必填项';
        isValid = false;
      } else if (!emailRegex.test(formData.email)) {
        newErrors.email = language === 'en' ? 'Invalid email format' : '电子邮件格式无效';
        isValid = false;
      }
    } else if (isRegisterMode && !verifiedEmail) {
      newErrors.email = language === 'en'
        ? 'Please verify your email before creating an account.'
        : '请先验证邮箱再创建账号。';
      isValid = false;
    } else if (
      isRegisterMode &&
      verifiedEmail &&
      formData.email.trim().toLowerCase() !== verifiedEmail
    ) {
      newErrors.email = language === 'en'
        ? 'Please use the same email you verified.'
        : '请使用已验证的邮箱。';
      isValid = false;
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = language === 'en' ? 'Password is required' : '密码为必填项';
      isValid = false;
    } else if (isRegisterMode && formData.password.length < 8) {
      newErrors.password = language === 'en' ? 'Password must be at least 8 characters' : '密码至少需要8个字符';
      isValid = false;
    }

    // Confirm password validation (only for registration)
    if (isRegisterMode) {
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = language === 'en' ? 'Please confirm your password' : '请确认您的密码';
        isValid = false;
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = language === 'en' ? 'Passwords do not match' : '密码不匹配';
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const submit = async () => {
        try {
          if (!isRegisterMode) {
            setLoginSubmitError('');
            const defaultInvalid =
              language === 'en' ? 'Invalid email or password.' : '邮箱或密码不正确。';
            const loginRes = await fetch(`${getApiBaseUrl()}/user-accounts/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: formData.email.trim().toLowerCase(),
                password: formData.password
              })
            });
            const raw = await loginRes.text();
            const interpreted = interpretChonLoginResponse(loginRes, raw, defaultInvalid);
            if (interpreted.type === 'bad_response') {
              setLoginSubmitError(
                language === 'en'
                  ? 'Login could not reach the API (invalid response). Set VITE_API_URL at build time or proxy /api to Flask — see apiBaseUrl.ts.'
                  : '无法连接登录接口（返回无效）。请配置 VITE_API_URL 或将 /api 反向代理到后端。'
              );
              return;
            }
            if (interpreted.type === 'auth') {
              setLoginSubmitError(interpreted.message);
              return;
            }

            const loginJson = interpreted.data;

            localStorage.setItem(
              'userAccount',
              JSON.stringify({
                email: formData.email.trim().toLowerCase(),
                createdAt: new Date().toISOString()
              })
            );

            const hasResults = applyLoginSnapshotPayload(loginJson, formData.email);
            if (hasResults) {
              navigate('/personality-test/results');
            } else {
              navigate('/personality-test/intro');
            }
            return;
          }

          const userSessionId = localStorage.getItem('userSessionId');
          if (!userSessionId) {
            alert(language === 'en'
              ? 'No test session found. Please complete the personality test first.'
              : '未找到测试会话，请先完成性格测试。');
            return;
          }

          if (localStorage.getItem('emailVerified') !== 'true') {
            alert(language === 'en'
              ? 'Please verify your email before creating an account.'
              : '请先验证邮箱再创建账号。');
            setAccountPhase('verify');
            return;
          }

          const response = await fetch(`${getApiBaseUrl()}/user-accounts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              user_session_id: userSessionId
            })
          });

          if (!response.ok) {
            if (response.status === 409) {
              alert(language === 'en'
                ? 'An account with this email already exists. Please Log in.'
                : '该邮箱已存在账号，请直接登录。');
              return;
            }
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to create user account');
          }

          localStorage.setItem(
            'userAccount',
            JSON.stringify({
              email: formData.email.trim().toLowerCase(),
              createdAt: new Date().toISOString()
            })
          );
          
          alert(language === 'en' ? 'Account created successfully!' : '账号创建成功！');

          const snapRes = await fetch(`${getApiBaseUrl()}/user-accounts/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.email.trim().toLowerCase(),
              password: formData.password
            })
          });
          const snapRaw = await snapRes.text();
          const snapInterpreted = interpretChonLoginResponse(
            snapRes,
            snapRaw,
            language === 'en' ? 'Invalid email or password.' : '邮箱或密码不正确。'
          );
          const hasResults =
            snapInterpreted.type === 'ok'
              ? applyLoginSnapshotPayload(snapInterpreted.data, formData.email)
              : false;
          if (hasResults) {
            navigate('/personality-test/results');
          } else {
            navigate('/personality-test/intro');
          }
        } catch (error) {
          console.error('Account action failed:', error);
          if (!isRegisterMode) {
            setLoginSubmitError(
              language === 'en' ? 'Login failed. Please try again.' : '登录失败，请重试。'
            );
          } else {
            alert(
              language === 'en'
                ? 'Failed to create account. Please try again.'
                : '创建账号失败，请重试。'
            );
          }
        }
      };

      void submit();
    }
  };

  const handleLogout = () => {
    // Clear all user data
    localStorage.removeItem('userAccount');
    localStorage.removeItem('tagStats');
    localStorage.removeItem('tagScores');
    
    // Clear question scores for all tags
    const chineseTags = ['自我意识', '奉献精神', '社交情商', '情绪调节', '客观能力', '核心耐力'];
    chineseTags.forEach(tag => {
      localStorage.removeItem(`questionScores_${tag}`);
    });
    
    setIsLoggedIn(false);
    setMostFittedCharacter(null);
    
    // Redirect to personality test to restart
    navigate('/personality-test/intro');
  };

  // Forgot password handlers
  const handleForgotPasswordClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setForgotPasswordStep('email');
    setForgotPasswordData({ email: '' });
    setForgotPasswordErrors({ email: '' });
  };

  const handleForgotPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForgotPasswordData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (forgotPasswordErrors[name as keyof typeof forgotPasswordErrors]) {
      setForgotPasswordErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!forgotPasswordData.email) {
      setForgotPasswordErrors(prev => ({ ...prev, email: language === 'en' ? 'Email is required' : '请输入邮箱地址' }));
      return;
    }
    if (!emailRegex.test(forgotPasswordData.email)) {
      setForgotPasswordErrors(prev => ({ ...prev, email: language === 'en' ? 'Please enter a valid email' : '请输入有效的邮箱地址' }));
      return;
    }

    try {
      const checkResponse = await fetch(`${getApiBaseUrl()}/user-accounts/exists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordData.email })
      });
      if (!checkResponse.ok) {
        throw new Error('Failed to verify account');
      }
      const checkData = await checkResponse.json();
      const exists =
        checkData?.exists === true ||
        checkData?.exists === 'true' ||
        checkData?.exists === 1;
      if (!exists) {
        setForgotPasswordErrors(prev => ({
          ...prev,
          email: language === 'en'
            ? 'No account found with this email.'
            : '该邮箱未找到账号。'
        }));
        return;
      }

      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordData.email, {
        redirectTo: redirectUrl
      });

      if (error) {
        throw error;
      }

      setForgotPasswordStep('sent');
    } catch (error) {
      console.error('Error sending reset link:', error);
      setForgotPasswordErrors(prev => ({ 
        ...prev, 
        email: language === 'en' ? 'Failed to send reset link. Please try again.' : '发送重置链接失败，请重试。' 
      }));
    }
  };

  const handleBackToLogin = () => {
    setForgotPasswordStep('none');
    setForgotPasswordData({ email: '' });
    setForgotPasswordErrors({ email: '' });
  };
  
  return (
    <div className="login-container" lang={language}>
      <div className="molecule-background"></div>
      
      {isLoggedIn ? (
        // Logged in state - show character and logout
        <>
          <div className="login-content logged-in-content" lang={language}>
            <div className="character-display">
              <h1 className="welcome-message" lang={language}>
                {language === 'en' ? 'Welcome Back!' : '欢迎回来！'}
              </h1>
              <img 
                src={mostFittedCharacter?.image} 
                alt={language === 'en' ? mostFittedCharacter?.name?.en : mostFittedCharacter?.name?.zh}
                className="character-image"
              />
              <h2 className="character-name">
                {language === 'en' ? mostFittedCharacter?.name?.en : mostFittedCharacter?.name?.zh}
              </h2>
              <p className="character-description">
                {language === 'en' 
                  ? 'Your most fitted character from the personality test'
                  : '您在性格测试中最匹配的角色'
                }
              </p>
              <button 
                type="button" 
                className="logout-button"
                onClick={handleLogout}
              >
                {language === 'en' ? 'Logout' : '退出登录'}
              </button>
            </div>
          </div>
        </>
      ) : (
        // Not logged in state - show login/register form or forgot password forms
        <>
          {forgotPasswordStep === 'none' ? (
            isVerifyMode ? (
              <AccountEmailVerification
                onVerified={(email) => {
                  setFormData((prev) => ({ ...prev, email: email || prev.email }));
                  setAccountPhase('register');
                }}
                onBack={() => navigate('/personality-test/results')}
              />
            ) : (
            <>
              <h1 lang={language}>
                {isRegisterMode
                  ? (language === 'en' ? 'Create Account' : '创建账号')
                  : (language === 'en' ? 'Login' : '登录')}
              </h1>
      <div className="login-content" lang={language}>
        <form className="registration-form" onSubmit={handleSubmit}>
          {!isRegisterMode ? (
            loginSubmitError ? (
            <p className="login-submit-error" role="alert">
              {loginSubmitError}
            </p>
          ) : null) : null}
          {/* Email Field */}
          {!shouldHideEmailField ? (
            <div className="form-group">
              <label htmlFor="email">
                {language === 'en' ? 'Email' : '电子邮件'}
                <span className="required">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder={language === 'en' ? 'Enter your email' : '请输入您的电子邮件'}
                className={errors.email ? 'error' : ''}
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>
          ) : (
            <div className="form-group">
              <label>
                {language === 'en' ? 'Email' : '电子邮件'}
              </label>
              <div className="readonly-email">
                {verifiedEmailNormalized}
              </div>
            </div>
          )}

          {/* Password Field */}
          <div className="form-group">
            <label htmlFor="password">
              {language === 'en' ? 'Password' : '密码'}
              <span className="required">*</span>
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={isRegisterMode 
                ? (language === 'en' ? 'At least 8 characters' : '至少8个字符')
                : (language === 'en' ? 'Enter your password' : '请输入您的密码')}
              className={errors.password ? 'error' : ''}
            />
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>

          {/* Confirm Password Field - Only show in register mode */}
          {isRegisterMode && (
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
              />
              {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
            </div>
          )}

          {/* Submit Button */}
          <button type="submit" className="submit-button">
            {isRegisterMode
              ? (language === 'en' ? 'Create Account' : '创建账号')
              : (language === 'en' ? 'Login' : '登录')}
          </button>
          
          {/* Forgot Password / Sign Up Links */}
          {!isRegisterMode ? (
            <div className="form-links">
              <a
                href="#"
                className="link-text"
                onClick={(e) => {
                  e.preventDefault();
                  handleForgotPasswordClick(e);
                }}
              >
            {language === 'en' ? 'Forgot password?' : '忘记密码？'}
          </a>
              <Link
                to="/personality-test/intro"
                className="link-text signup-link"
                onClick={(e) => {
                  const hasResults = localStorage.getItem('tagStats');
                  if (hasResults) {
                    e.preventDefault();
                    navigate('/personality-test/results');
                  }
                }}
              >
                <span className="signup-line1">
                  {language === 'en' ? "Don't have an account?" : '还没有账号？'}
                </span>
                <span className="signup-line2">
                  {language === 'en' ? "Take the personality test" : '参加性格测试'}
                </span>
              </Link>
            </div>
          ) : (
            <button
              type="button"
              className="link-text back-button"
              onClick={() => setAccountPhase('verify')}
            >
              {language === 'en' ? '← Use a different email' : '← 使用其他邮箱'}
            </button>
          )}
        </form>
              </div>
            </>
            )
          ) : (
            <>
              {/* Forgot Password Forms */}
              {forgotPasswordStep === 'email' && (
        <div className="login-content forgot-password-content" lang={language}>
          <h2 dangerouslySetInnerHTML={{ 
            __html: language === 'en' ? '<span style="color: #F0BDC0;">Reset Password</span>' : '<span style="color: #F0BDC0;">重置密码</span>' 
          }}></h2>
          <form className="registration-form" onSubmit={handleSendResetLink}>
            <div className="form-group">
              <label htmlFor="forgot-email">
                {language === 'en' ? 'Email Address' : '邮箱地址'}
                <span className="required">*</span>
              </label>
              <input
                type="email"
                id="forgot-email"
                name="email"
                value={forgotPasswordData.email}
                onChange={handleForgotPasswordChange}
                placeholder={language === 'en' ? 'Enter your email address' : '请输入您的邮箱地址'}
                className={forgotPasswordErrors.email ? 'error' : ''}
              />
              {forgotPasswordErrors.email && <span className="error-message">{forgotPasswordErrors.email}</span>}
            </div>
            
            <button type="submit" className="submit-button">
              {language === 'en' ? 'Send Reset Link' : '发送重置链接'}
            </button>
            
            <button type="button" className="link-text back-button" onClick={handleBackToLogin}>
              {language === 'en' ? '← Back to Login' : '← 返回登录'}
            </button>
          </form>
        </div>
      )}

      {forgotPasswordStep === 'sent' && (
        <div className="login-content forgot-password-content" lang={language}>
          <h2 dangerouslySetInnerHTML={{ 
            __html: language === 'en' ? '<span style="color: #F0BDC0;">Check your email</span>' : '<span style="color: #F0BDC0;">请检查邮箱</span>' 
          }}></h2>
          <p className="otp-instruction">
            {language === 'en' 
              ? `We sent a reset link to ${forgotPasswordData.email}.` 
              : `我们已向 ${forgotPasswordData.email} 发送重置链接。`}
          </p>
          <button type="button" className="link-text back-button" onClick={handleBackToLogin}>
            {language === 'en' ? '← Back to Login' : '← 返回登录'}
          </button>
        </div>
      )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Login; 
