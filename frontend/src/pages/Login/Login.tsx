import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
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
      // TODO: Submit form data to backend
      console.log('Form submitted:', formData);
      alert(language === 'en' ? 'Account created successfully!' : '账户创建成功！');
    }
  };
  
  return (
    <div className="login-container" lang={language}>
      <div className="molecule-background"></div>
      <div className="hexagon-pattern"></div>
      <h1 lang={language}>
        {mode === 'register' 
          ? (language === 'en' ? 'Create Account' : '创建账户')
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
              ? (language === 'en' ? 'Create Account' : '创建账户')
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
                  {language === 'en' ? "Don't have an account?" : '还没有账户？'}
                </span>
                <span className="signup-line2">
                  {language === 'en' ? "Take the personality test" : '参加性格测试'}
                </span>
              </a>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
};

export default Login; 