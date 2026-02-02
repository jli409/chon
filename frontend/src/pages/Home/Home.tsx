import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import './Home.css';

const Home = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const renderHtml = (html: string) => {
    const wrappedHtml = `<span lang="${language}">${html}</span>`;
    return <span dangerouslySetInnerHTML={{ __html: wrappedHtml }} />;
  };

  const debugLanguage = useCallback(() => {
    console.log('Current language in Home:', language);
    console.log('Current translations in Home:', t);
  }, [language, t]);

  React.useEffect(() => {
    debugLanguage();
  }, [debugLanguage]);

  const handleCtaClick = () => {
    navigate('/personality-test/intro');
  };

  return (
    <main className="main-content" lang={language}>
      {/* Background Elements */}
      <div className="molecule-background"></div>
      <div className="hexagon-pattern"></div>
      
      {/* Logo */}
      <div className="logo-container">
        <h1 className="logo" lang="en">
          CH<span className="highlight-letter">O</span>N
        </h1>
      </div>

      {/* Content Sections - unified paragraphs */}
      <section className="content-section unified-home-paragraphs" lang={language}>
        {t.home.paragraphs.map((html, idx) => (
          <p className={idx === 0 ? 'mission-statement' : idx === 1 ? 'dont-empower-text' : ''} key={idx} lang={language}>
            {renderHtml(html)}
          </p>
        ))}
      </section>

      {/* Call to Action Button */}
      <div className="cta-container">
        <button 
          className="cta-button" 
          onClick={handleCtaClick}
          lang={language}
        >
          {t.home.cta}
        </button>
      </div>
    </main>
  );
};

export default Home; 