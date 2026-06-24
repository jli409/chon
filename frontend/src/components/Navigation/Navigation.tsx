import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import routes from '../../router.ts';
import './Navigation.css';

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { t } = useLanguage();

  const getTranslatedName = (routeName: string) => {
    switch(routeName) {
      case 'HOME':
        return t.navigation.home;
      case 'PERSONALITY TEST':
        return t.navigation.personalityTest;
      case 'CONTACT US':
        return t.navigation.contact;
      case 'LOGIN':
        return t.navigation.login || 'Account';
      default:
        return routeName;
    }
  };

  const isActive = (path: string) => {
    // 检查当前路径是否是该路由或其子路由
    return currentPath === path || currentPath.startsWith(`${path}/`);
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string, routeName: string) => {
    // If clicking on Personality Test, check user status
    if (routeName === 'PERSONALITY TEST') {
      const hasAccount = localStorage.getItem('userAccount');
      const hasResults = localStorage.getItem('tagStats');
      
      console.log('Navigation clicked: Personality Test');
      console.log('Checking for user account:', hasAccount ? 'Found' : 'Not found');
      console.log('Checking for test results:', hasResults ? 'Found' : 'Not found');
      
      // If has account (logged in), go to results page
      if (hasAccount) {
        console.log('User has account, redirecting to results page...');
        e.preventDefault();
        navigate('/personality-test/results');
        return;
      }
      
      // If has results but no account, go to results page (can't create account yet)
      if (hasResults) {
        console.log('User has results but no account, redirecting to results page...');
        e.preventDefault();
        navigate('/personality-test/results');
        return;
      }
      
      // If no account and no results, proceed to personality test to start
      console.log('Complete new user, proceeding to personality test');
    }
  };

  const navRoutes = routes.filter(route => route.showInNav !== false);

  return (
    <nav className="nav-menu">
      {navRoutes.map((route) => (
        <Link
          key={route.path}
          to={route.path}
          className={`nav-link ${isActive(route.path) ? 'active' : ''}`}
          onClick={(e) => handleNavClick(e, route.path, route.name)}
        >
          {getTranslatedName(route.name)}
        </Link>
      ))}
    </nav>
  );
};

export default Navigation; 
