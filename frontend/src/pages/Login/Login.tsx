import { useLanguage } from '../../contexts/LanguageContext.tsx';
import './Login.css';

const Login = () => {
  const { t, language } = useLanguage();
  
  return (
    <div className="login-container" lang={language}>
      <div className="molecule-background"></div>
      <div className="hexagon-pattern"></div>
      <h1 lang={language}>{t.login.title}</h1>
      <div className="login-content" lang={language}>
        <p lang={language}>{t.login.comingSoon}</p>
      </div>
    </div>
  );
};

export default Login; 