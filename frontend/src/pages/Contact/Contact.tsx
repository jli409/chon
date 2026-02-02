import { useLanguage } from '../../contexts/LanguageContext.tsx';
import './Contact.css';

// 定义是否显示 Coming Soon 页面的标志
// 将此变量设置为 true 可以显示 Coming Soon 页面
// 设置为 false 可以显示原始联系页面
const SHOW_COMING_SOON = true;

const Contact = () => {
  const { t, language } = useLanguage();
  const isContactInfo = SHOW_COMING_SOON;
  
  const renderHtml = (html: string) => {
    const wrappedHtml = `<span lang="${language}">${html}</span>`;
    return <span dangerouslySetInnerHTML={{ __html: wrappedHtml }} />;
  };

  // 渲染 Coming Soon 页面
  const renderContactInfo = () => {
    return (
      <div className="contact-info-container" lang={language}>
        <div className="molecule-background"></div>
        <div className="hexagon-pattern"></div>
        
        <h1 lang={language}>{t.contact.title}</h1>
        <div className="contact-info-content" lang={language}>
          <p lang={language}>
            {renderHtml(t.contact.contactInfo)}
          </p>
        </div>
      </div>
    );
  };

  // 渲染原始联系页面
  const renderOriginalContact = () => {
    return (
      <>
        <div className="molecule-background"></div>
        <div className="hexagon-pattern"></div>
        
        <div className="contact-content">
          <p className="main-text" lang={language}>
            {t.contact.prototype.text}
          </p>
          
          <p className="main-text" lang={language}>
            {t.contact.expertise.text}
          </p>
          
          <p className="main-text" lang={language}>
            {t.contact.skills.text}
          </p>
        </div>

        <div className="buttons-container">
          <button className="contact-button" lang={language}>{t.contact.buttons.fund}</button>
          <button className="contact-button" lang={language}>{t.contact.buttons.join}</button>
          <button className="contact-button" lang={language}>{t.contact.buttons.collaborate}</button>
        </div>
      </>
    );
  };

  return (
    <main className={isContactInfo ? "contact-container contact-info-mode" : "contact-container"} lang={language}>
      {isContactInfo ? renderContactInfo() : renderOriginalContact()}
    </main>
  );
};

export default Contact; 