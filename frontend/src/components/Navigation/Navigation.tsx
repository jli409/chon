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
        return t.navigation.login || 'Login';
      default:
        return routeName;
    }
  };

  const isActive = (path: string) => {
    // 检查当前路径是否是该路由或其子路由
    return currentPath === path || currentPath.startsWith(`${path}/`);
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string, routeName: string) => {
    // If clicking on Personality Test and results exist, go to Results page instead
    if (routeName === 'PERSONALITY TEST') {
      const hasResults = localStorage.getItem('tagStats');
      console.log('Navigation clicked: Personality Test');
      console.log('Checking for test results:', hasResults ? 'Found' : 'Not found');
      console.log('localStorage tagStats:', hasResults);
      if (hasResults) {
        console.log('Redirecting to results page...');
        e.preventDefault();
        navigate('/results');
        return;
      }
      console.log('No results found, proceeding to personality test');
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