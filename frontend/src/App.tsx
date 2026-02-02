import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import Navigation from './components/Navigation/Navigation.tsx'
import LanguageSelector from './components/LanguageSelector/LanguageSelector.tsx'
import Home from './pages/Home/Home.tsx'
import PersonalityTest from './pages/PersonalityTest/PersonalityTest.tsx'
import Contact from './pages/Contact/Contact.tsx'
import Login from './pages/Login/Login.tsx'
import NotFound from './pages/NotFound/NotFound.tsx'
import ResetPassword from './pages/ResetPassword/ResetPassword.tsx'
import AuthCallback from './pages/AuthCallback/AuthCallback.tsx'
import { useLanguage } from './contexts/LanguageContext.tsx'
import { useEffect, useState } from 'react'
import './App.css'
import Results from './pages/Results/Results.tsx'

function App() {
  const { language } = useLanguage();
  const [whiteTheme, setWhiteTheme] = useState(false);
  const [hideUI, setHideUI] = useState(false);
  const location = useLocation();
  const isPersonalityTest = location.pathname.includes('/personality-test');

  // Force clear problematic localStorage on mount if needed
  useEffect(() => {
    // If we're on home page and localStorage has problematic state, clear it
    if (!isPersonalityTest) {
      const savedStep = localStorage.getItem('chon_personality_step');
      if (savedStep === 'questionnaire' || savedStep === 'privacy' || savedStep === 'email-verification') {
        console.warn('Clearing problematic localStorage state:', savedStep);
        localStorage.removeItem('chon_personality_step');
        localStorage.removeItem('chon_personality_show_first_page');
        localStorage.removeItem('chon_personality_show_second_page');
        localStorage.removeItem('chon_personality_show_third_page');
        localStorage.removeItem('chon_personality_show_fourth_page');
        localStorage.removeItem('chon_personality_show_fifth_page');
        localStorage.removeItem('chon_personality_show_sixth_page');
      }
    }
    
    // Always ensure initial state is correct
    console.log('App mounted, isPersonalityTest:', isPersonalityTest, 'hideUI:', hideUI);
  }, [isPersonalityTest, hideUI]);

  // 当语言变化时，更新HTML根元素的lang属性
  useEffect(() => {
    document.documentElement.lang = language;
    console.log('Document language set to:', language);
  }, [language]);

  // 监听路由变化，当不在personality-test页面时重置为黑色主题
  useEffect(() => {
    if (!isPersonalityTest) {
      setWhiteTheme(false);
      setHideUI(false);
    }
  }, [location.pathname, isPersonalityTest]);

  // Handler for setting white theme
  const handleWhiteThemeChange = (isWhite: boolean) => {
    console.log('Setting white theme:', isWhite);
    setWhiteTheme(isWhite);
  };
  
  // Handler for hiding UI elements
  const handleHideUIChange = (shouldHide: boolean) => {
    console.log('Setting hideUI:', shouldHide);
    setHideUI(shouldHide);
  };

  // 只有在PersonalityTest页面且hideUI为true时才隐藏导航栏和语言选择器
  const shouldHideNavigation = isPersonalityTest && hideUI;

  console.log('Rendering App - shouldHideNavigation:', shouldHideNavigation, 'isPersonalityTest:', isPersonalityTest, 'hideUI:', hideUI);

  return (
    <div className={`app-container ${whiteTheme ? 'white-theme' : ''}`} lang={language}>
      {!shouldHideNavigation && <Navigation />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/personality-test" element={<Navigate to="/personality-test/intro" replace />} />
        <Route path="/personality-test/results" element={<Results />} />
        <Route 
          path="/personality-test/:step" 
          element={
            <PersonalityTest 
              onWhiteThemeChange={handleWhiteThemeChange} 
              onHideUIChange={handleHideUIChange}
            />
          } 
        />
        <Route path="/results" element={<Results />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!shouldHideNavigation && (
        <div style={{ position: 'relative', zIndex: 100 }}>
          <LanguageSelector />
        </div>
      )}
    </div>
  )
}

export default App
