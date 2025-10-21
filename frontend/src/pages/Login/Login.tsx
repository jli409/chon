import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import { toEnglishTag } from '../../utils/tagUtils';
import { findBestMatchCharacter } from '../../utils/characterMatching';
import './Login.css';

const Login = () => {
  const { language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const mode = (location.state as { mode?: string })?.mode || 'login';
  
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mostFittedCharacter, setMostFittedCharacter] = useState<any>(null);

  // Check if user is logged in and get most fitted character
  useEffect(() => {
    const checkLoginStatus = () => {
      const hasAccount = localStorage.getItem('userAccount');
      const hasResults = localStorage.getItem('tagStats');
      
      if (hasAccount && hasResults) {
        setIsLoggedIn(true);
        
        // Get the most fitted character from results
        const tagStats = JSON.parse(hasResults);
        const cardsData = [
          {
            id: 'odin',
            name: { en: 'Odin', zh: '奥丁' },
            image: '/images/characters/odin.jpg',
            tagRanges: {
              selfAwareness: [80, 100] as [number, number],
              dedication: [20, 50] as [number, number],
              socialIntelligence: [30, 60] as [number, number],
              emotionalRegulation: [20, 50] as [number, number],
              objectivity: [60, 80] as [number, number],
              coreEndurance: [0, 60] as [number, number]
            }
          },
          {
            id: 'wukong',
            name: { en: 'Wukong', zh: '大圣' },
            image: '/images/characters/wukong.jpg',
            tagRanges: {
              selfAwareness: [40, 60] as [number, number],
              dedication: [0, 40] as [number, number],
              socialIntelligence: [40, 70] as [number, number],
              emotionalRegulation: [80, 100] as [number, number],
              objectivity: [40, 60] as [number, number],
              coreEndurance: [40, 60] as [number, number]
            }
          },
          {
            id: 'prometheus',
            name: { en: 'Prometheus', zh: '普罗米修斯' },
            image: '/images/characters/prometheus.jpg',
            tagRanges: {
              selfAwareness: [0, 40] as [number, number],
              dedication: [80, 100] as [number, number],
              socialIntelligence: [30, 60] as [number, number],
              emotionalRegulation: [10, 50] as [number, number],
              objectivity: [30, 70] as [number, number],
              coreEndurance: [60, 80] as [number, number]
            }
          },
          {
            id: 'nuwa',
            name: { en: 'Nüwa', zh: '女娲' },
            image: '/images/characters/nuwa.jpg',
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
            image: '/images/characters/athena.jpg',
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
            image: '/images/characters/venus.jpg',
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

        // Calculate user scores and find best match using sum of squares
        const userScores: Record<string, number> = {};
        Object.keys(tagStats).forEach(tag => {
          if (tagStats[tag] && typeof tagStats[tag].scorePercentage === 'number') {
            const engKey = toEnglishTag(tag);
            if (engKey) {
              userScores[engKey] = tagStats[tag].scorePercentage;
            }
          }
        });

        // Find best match using sum of squares difference
        const bestMatch = findBestMatchCharacter(userScores, cardsData);
        setMostFittedCharacter(bestMatch);
      } else {
        setIsLoggedIn(false);
        setMostFittedCharacter(null);
      }
    };

    checkLoginStatus();
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
  };

  const validateForm = () => {
    const newErrors = {
      email: '',
      password: '',
      confirmPassword: ''
    };
    let isValid = true;

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      newErrors.email = language === 'en' ? 'Email is required' : '电子邮件为必填项';
      isValid = false;
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = language === 'en' ? 'Invalid email format' : '电子邮件格式无效';
      isValid = false;
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = language === 'en' ? 'Password is required' : '密码为必填项';
      isValid = false;
    } else if (mode === 'register' && formData.password.length < 8) {
      newErrors.password = language === 'en' ? 'Password must be at least 8 characters' : '密码至少需要8个字符';
      isValid = false;
    }

    // Confirm password validation (only for registration)
    if (mode === 'register') {
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
      // Save account data to localStorage
      localStorage.setItem('userAccount', JSON.stringify({
        email: formData.email,
        password: formData.password,
        createdAt: new Date().toISOString()
      }));
      
      console.log('Form submitted:', formData);
      alert(language === 'en' ? 'Account created successfully!' : '账号创建成功！');
      
      // Redirect to results if test has been taken
      const hasResults = localStorage.getItem('tagStats');
      if (hasResults) {
        navigate('/results');
      } else {
        navigate('/personality-test');
      }
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
    navigate('/personality-test');
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
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/images/characters/odin.jpg'; // fallback
                }}
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
        // Not logged in state - show login/register form
        <>
          <h1 lang={language}>
            {mode === 'register' 
              ? (language === 'en' ? 'Create Account' : '创建账号')
              : (language === 'en' ? 'Login' : '登录')}
          </h1>
      <div className="login-content" lang={language}>
        <form className="registration-form" onSubmit={handleSubmit}>
          {/* Email Field */}
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
              placeholder={mode === 'register' 
                ? (language === 'en' ? 'At least 8 characters' : '至少8个字符')
                : (language === 'en' ? 'Enter your password' : '请输入您的密码')}
              className={errors.password ? 'error' : ''}
            />
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>

          {/* Confirm Password Field - Only show in register mode */}
          {mode === 'register' && (
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
            {mode === 'register'
              ? (language === 'en' ? 'Create Account' : '创建账号')
              : (language === 'en' ? 'Login' : '登录')}
          </button>
          
          {/* Forgot Password / Sign Up Links */}
          {mode === 'login' ? (
            <div className="form-links">
              <a href="#" className="link-text" onClick={(e) => e.preventDefault()}>
                {language === 'en' ? 'Forgot password?' : '忘记密码？'}
              </a>
              <a 
                href="/personality-test" 
                className="link-text signup-link"
                onClick={(e) => {
                  const hasResults = localStorage.getItem('tagStats');
                  if (hasResults) {
                    e.preventDefault();
                    navigate('/results');
                  }
                }}
              >
                <span className="signup-line1">
                  {language === 'en' ? "Don't have an account?" : '还没有账号？'}
                </span>
                <span className="signup-line2">
                  {language === 'en' ? "Take the personality test" : '参加性格测试'}
                </span>
              </a>
            </div>
          ) : null}
        </form>
      </div>
        </>
      )}
    </div>
  );
};

export default Login; 