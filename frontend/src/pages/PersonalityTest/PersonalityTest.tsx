import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import LanguageSelector from '../../components/LanguageSelector/LanguageSelector.tsx';
import './PersonalityTest.css';
import BothQuestionnaire from './BothQuestionnaire.tsx';
import { scrollToNextQuestion, scrollToFirstQuestionOfNextPage } from './ScrollUtils.ts';
import questionnaireApi, { prepareQuestionResponses, QuestionResponse } from '../../api/questionnaire.ts';
import { questionnaires, Question, QuestionType, QuestionnaireType, QuestionnaireContext } from './questionnaires.ts';

// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

type IdentityType = 'mother' | 'corporate' | 'both' | 'other';
type TestStep = 'intro' | 'identity' | 'privacy' | 'questionnaire';

interface PersonalityTestProps {
  onWhiteThemeChange?: (isWhite: boolean) => void;
  onHideUIChange?: (shouldHide: boolean) => void;
}

// MetaTags Component for Mobile Optimization
const MetaTags = () => {
  React.useEffect(() => {
    // Ensure the viewport meta tag is set correctly for this page
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
    
    // Cleanup function to restore the original meta tag when component unmounts
    return () => {
      if (viewportMeta) {
        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0');
      }
    };
  }, []);
  
  return null;
};

const PersonalityTest = ({ onWhiteThemeChange, onHideUIChange }: PersonalityTestProps) => {
  const { t, language } = useLanguage();
  const navigate = useNavigate(); // 添加导航钩子
  const location = useLocation();
  const [step, setStep] = useState<TestStep>('intro');
  const [userChoice, setUserChoice] = useState<string | null>(null);
  const [selectedIdentities, setSelectedIdentities] = useState<Set<IdentityType>>(new Set());
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [typingText, setTypingText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  // Identity roles expansion for corporate
  const [showCorporateRoles, setShowCorporateRoles] = useState(false);
  const [selectedCorporateRole, setSelectedCorporateRole] = useState<string | null>(null);
  const corporateRolesEn = [
    'Founder', 'Board Member', 'C-Suite Executive', 'President', 'Managing Director',
    'Partner', 'Vice President', 'Director', 'Senior Manager'
  ];
  const corporateRolesZh = [
    '企业创始人', '董事会成员', 'C级高管', '总裁', '董事总经理',
    '合伙人', '副总裁', '总监', '高级经理'
  ];
  const [showFirstPage, setShowFirstPage] = useState(true);
  const [showSecondPage, setShowSecondPage] = useState(false);
  const [showThirdPage, setShowThirdPage] = useState(false);
  const [showFourthPage, setShowFourthPage] = useState(false);
  const [showFifthPage, setShowFifthPage] = useState(false);
  const [showSixthPage, setShowSixthPage] = useState(false);
  const [showSaveIndicator, setShowSaveIndicator] = useState(false);
  // 替换静态百分比为动态状态
  const [introStats, setIntroStats] = useState({
    yesCount: 0,
    noCount: 0,
    yesPercentage: 65, // 默认值，将被API数据替换
    loading: true
  });
  // Add state to track current questionnaire type
  const [activeQuestionnaire, setActiveQuestionnaire] = useState<QuestionnaireType | null>(null);
  // Add state to track secondary questionnaire for "both" option
  const [secondaryQuestionnaire, setSecondaryQuestionnaire] = useState<QuestionnaireType | null>(null);
  // Add state to track if we're showing the primary or secondary questionnaire
  const [showingPrimaryQuestionnaire, setShowingPrimaryQuestionnaire] = useState(true);
  // Add state to track primary answers separately from secondary
  const [primaryAnswers, setPrimaryAnswers] = useState<Record<number, string>>({});
  const [secondaryAnswers, setSecondaryAnswers] = useState<Record<number, string>>({});
  // 添加标签得分计算相关的状态
  const [tagScores, setTagScores] = useState<Record<string, number[]>>({});
  
  // Add new state for branch tracking after the existing state declarations
  const [branchingPath, setBranchingPath] = useState<'default' | 'yes-path' | 'no-path'>('default');
  const [hasBranchingQuestion, setHasBranchingQuestion] = useState(false);
  
  

  // Helper to get current questionnaire
  const getCurrentQuestionnaire = (): QuestionnaireContext | null => {
    // When both mother and corporate are selected
    if (selectedIdentities.has('mother') && selectedIdentities.has('corporate')) {
      if (showingPrimaryQuestionnaire) {
        return activeQuestionnaire ? questionnaires[activeQuestionnaire] : null;
      } else {
        return secondaryQuestionnaire ? questionnaires[secondaryQuestionnaire] : null;
      }
    }
    
    // Single selection case
    return activeQuestionnaire ? questionnaires[activeQuestionnaire] : null;
  };

  // Helper to get current questions
  const getCurrentQuestions = (): Question[] => {
    return getCurrentQuestionnaire()?.questions || [];
  };
  
  // Helper to get total questions count
  const getTotalQuestions = (): number => {
    return getCurrentQuestionnaire()?.totalQuestions || 0;
  };
  
  // 从本地存储加载答案数据
  useEffect(() => {
    const savedAnswers = localStorage.getItem('chon_personality_answers');
    const savedStep = localStorage.getItem('chon_personality_step');
    const savedIdentities = localStorage.getItem('chon_personality_identities');
    const savedUserChoice = localStorage.getItem('chon_personality_user_choice');
    const savedShowFirstPage = localStorage.getItem('chon_personality_show_first_page');
    const savedShowSecondPage = localStorage.getItem('chon_personality_show_second_page');
    const savedShowThirdPage = localStorage.getItem('chon_personality_show_third_page');
    const savedShowFourthPage = localStorage.getItem('chon_personality_show_fourth_page');
    const savedShowFifthPage = localStorage.getItem('chon_personality_show_fifth_page');
    const savedShowSixthPage = localStorage.getItem('chon_personality_show_sixth_page');
    
    if (savedAnswers) {
      setAnswers(JSON.parse(savedAnswers));
    }
    
    if (savedStep && isValidStep(savedStep)) {
      setStep(savedStep as TestStep);
    }
    
    if (savedIdentities) {
      setSelectedIdentities(new Set(JSON.parse(savedIdentities)));
    }
    
    if (savedUserChoice) {
      setUserChoice(savedUserChoice);
    }
    
    if (savedShowFirstPage) {
      setShowFirstPage(savedShowFirstPage === 'true');
    }
    
    if (savedShowSecondPage) {
      setShowSecondPage(savedShowSecondPage === 'true');
    }
    
    if (savedShowThirdPage) {
      setShowThirdPage(savedShowThirdPage === 'true');
    }
    
    if (savedShowFourthPage) {
      setShowFourthPage(savedShowFourthPage === 'true');
    }
    
    if (savedShowFifthPage) {
      setShowFifthPage(savedShowFifthPage === 'true');
    }
    
    if (savedShowSixthPage) {
      setShowSixthPage(savedShowSixthPage === 'true');
    }
  }, []);
  
  // 验证步骤值是否有效
  const isValidStep = (step: string): boolean => {
    return ['intro', 'identity', 'privacy', 'questionnaire'].includes(step);
  };
  
  // 保存答案到本地存储
  useEffect(() => {
    localStorage.setItem('chon_personality_answers', JSON.stringify(answers));
    if (Object.keys(answers).length > 0) {
      setShowSaveIndicator(true);
      const timer = setTimeout(() => {
        setShowSaveIndicator(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [answers]);
  
  // 保存当前步骤到本地存储
  useEffect(() => {
    localStorage.setItem('chon_personality_step', step);
  }, [step]);
  
  // 保存身份选择到本地存储
  useEffect(() => {
    localStorage.setItem('chon_personality_identities', JSON.stringify(Array.from(selectedIdentities)));
  }, [selectedIdentities]);
  
  // 保存用户选择到本地存储
  useEffect(() => {
    if (userChoice) {
      localStorage.setItem('chon_personality_user_choice', userChoice);
    }
  }, [userChoice]);
  
  // 保存问题索引和页面状态到本地存储
  useEffect(() => {
    localStorage.setItem('chon_personality_show_first_page', showFirstPage.toString());
    localStorage.setItem('chon_personality_show_second_page', showSecondPage.toString());
    localStorage.setItem('chon_personality_show_third_page', showThirdPage.toString());
    localStorage.setItem('chon_personality_show_fourth_page', showFourthPage.toString());
    localStorage.setItem('chon_personality_show_fifth_page', showFifthPage.toString());
    localStorage.setItem('chon_personality_show_sixth_page', showSixthPage.toString());
  }, [showFirstPage, showSecondPage, showThirdPage, showFourthPage, showFifthPage, showSixthPage]);

  // Update white theme state when step changes
  useEffect(() => {
    if (onWhiteThemeChange) {
      const isWhiteTheme = step === 'privacy' || step === 'questionnaire';
      onWhiteThemeChange(isWhiteTheme);
      
      // Remove hormone-related style customization since those pages no longer exist
        const existingStyle = document.getElementById('hormone-style');
        if (existingStyle) {
          existingStyle.remove();
      }
    }
  }, [step, onWhiteThemeChange]);

  // Typing animation effect for privacy statement
  useEffect(() => {
    if (step === 'privacy') {
      const currentQuestionnaire = getCurrentQuestionnaire();
      if (!currentQuestionnaire) return;

      const privacyTextEn = "<strong style=\"font-size: 1.2em;\">Data Usage and Privacy Statement</strong><br><br>At CHON, your privacy is fundamental. We only collect the information necessary to deliver meaningful insights, and we protect it with the highest standards of security and integrity.<br><br><hr><br><br><strong style=\"font-size: 1.2em;\">For Individual Participants</strong><br><br>Your personal information will be used solely for the following purposes:<br><ul><li>To verify your eligibility for specific sections of the survey</li><li>To support demographic and statistical analysis across participant groups</li><li>To generate your personalized CHON personality profile</li></ul>";
      
      const privacyTextZh = "<strong style=\"font-size: 1.2em;\">数据使用与隐私声明</strong><br><br>在 CHON，我们将您的隐私视为基本原则。我们仅收集实现分析目的所必需的信息，并以最高标准保障数据的安全与完整性。<br><br><hr><br><br><strong style=\"font-size: 1.2em;\">针对个人参与者</strong><br><br>您的个人信息将仅用于以下用途：<br><ul><li>验证您是否符合特定问卷部分的参与资格</li><li>用于不同人群的统计与人口特征分析</li><li>生成您的个性化 CHON 性格分析报告</li></ul>";

      const fullText = language === 'en' 
        ? currentQuestionnaire.privacyStatement?.contentEn || privacyTextEn
        : currentQuestionnaire.privacyStatement?.contentZh || privacyTextZh;

      setTypingText('');
      setIsTyping(true);
      
      let currentIndex = 0;
      const typingInterval = setInterval(() => {
        if (currentIndex < fullText.length) {
          setTypingText(fullText.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          setIsTyping(false);
          clearInterval(typingInterval);
        }
      }, 30); // Adjust speed as needed

      return () => clearInterval(typingInterval);
    }
  }, [step, language]);

  // 根据步骤决定是否隐藏UI元素
  useEffect(() => {
    if (onHideUIChange) {
      const shouldHideUI = step === 'privacy' || step === 'questionnaire';
      onHideUIChange(shouldHideUI);
    }
  }, [step, onHideUIChange]);

  // Reset corporate roles state when returning to identity step
  useEffect(() => {
    if (step === 'identity') {
      setShowCorporateRoles(false);
      setSelectedCorporateRole(null);
    }
  }, [step]);

  // 添加获取intro统计数据的函数
  const fetchIntroStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/intro-stats`);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      
      // 只有在用户已经做出选择时，才更新UI显示
      setIntroStats({
        yesCount: data.yes_count,
        noCount: data.no_count,
        yesPercentage: data.yes_percentage,
        loading: false
      });
      
      console.log("Fetched intro stats:", data);
    } catch (error) {
      console.error("Error fetching intro stats:", error);
      setIntroStats(prev => ({...prev, loading: false}));
    }
  };

  // 在用户选择yes/no后获取最新统计数据
  useEffect(() => {
    if (userChoice) {
      // 稍微延迟，让后端有时间更新数据
      const timer = setTimeout(() => {
        fetchIntroStats();
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [userChoice]);

  // 在组件挂载或step变为'intro'时进行初始化
  useEffect(() => {
    if (step === 'intro') {
      // 重置userChoice，确保用户每次回到intro页面时都会看到选项
      setUserChoice(null);
      
      // 同时预加载统计数据，但不会影响UI显示
      fetchIntroStats();
    }
  }, [step]);

  const handleOptionClick = (choice: string) => {
    setUserChoice(choice);
    
    // 实时保存intro choice到后端
    questionnaireApi.saveIntroChoice(choice);
    // 设置loading状态，等待数据更新
    setIntroStats(prev => ({...prev, loading: true}));
  };
  
  const handleBeginTest = () => {
    setStep('identity');
  };

  const handleIdentitySelect = (identity: IdentityType) => {
    // 创建一个新的集合来保存所选身份
    const newSelectedIdentities = new Set(selectedIdentities);

    // If 'other' is selected, clear all other selections
    if (identity === 'other') {
      if (newSelectedIdentities.has('other')) {
        newSelectedIdentities.delete('other');
      } else {
        newSelectedIdentities.clear();
        newSelectedIdentities.add('other');
        setActiveQuestionnaire('other');
      }
    } else {
      // Handle mother/corporate selection
      if (newSelectedIdentities.has(identity)) {
        newSelectedIdentities.delete(identity);
      } else {
        newSelectedIdentities.delete('other'); // Remove 'other' if it was selected
        newSelectedIdentities.add(identity);
      }
    }

    // Update active questionnaire based on selections
    if (newSelectedIdentities.has('mother') && newSelectedIdentities.has('corporate')) {
      // If both mother and corporate are selected, set 'both' questionnaire
      setActiveQuestionnaire('both');
    } else if (newSelectedIdentities.has('mother')) {
      setActiveQuestionnaire('mother');
    } else if (newSelectedIdentities.has('corporate')) {
      setActiveQuestionnaire('corporate');
    } else if (newSelectedIdentities.has('other')) {
      setActiveQuestionnaire('other');
    } else {
      // If no identity is selected, clear the active questionnaire
      setActiveQuestionnaire(null);
    }

    // 更新状态
    setSelectedIdentities(newSelectedIdentities);
  };

  const handleContinue = () => {
    if (selectedIdentities.size === 0) {
      return;
    }

    // Set active questionnaire type based on selected identity
    if (selectedIdentities.has('mother') && selectedIdentities.has('corporate')) {
      // For "both" option, set the 'both' questionnaire
      setActiveQuestionnaire('both');
      setSecondaryQuestionnaire(null);
    } else if (selectedIdentities.has('mother')) {
      setActiveQuestionnaire('mother');
      setSecondaryQuestionnaire(null);
    } else if (selectedIdentities.has('corporate')) {
      setActiveQuestionnaire('corporate');
      setSecondaryQuestionnaire(null);
    } else if (selectedIdentities.has('other')) {
      setActiveQuestionnaire('other');
      setSecondaryQuestionnaire(null);
    }

    // Proceed to privacy statement
    setStep('privacy');
  };

  const handlePrivacyContinue = () => {
    // 确保所有页面状态初始化
    setShowFirstPage(true);
    setShowSecondPage(false);
    setShowThirdPage(false);
    setShowFourthPage(false);
    setShowFifthPage(false);
    setShowSixthPage(false);
    
    // 如果是both类型，初始化primary和secondary答案容器
    if (activeQuestionnaire === 'both') {
      setPrimaryAnswers({});
      setSecondaryAnswers({});
      setShowingPrimaryQuestionnaire(true);
    }
    
    // 设置为问卷步骤
    setStep('questionnaire');
    
    // 通知父组件需要设置白色主题和隐藏UI
    if (onWhiteThemeChange) {
      onWhiteThemeChange(true);
    }
    
    if (onHideUIChange) {
      onHideUIChange(true);
    }
  };

  const isIdentitySelected = (identity: IdentityType): boolean => {
    return selectedIdentities.has(identity);
  };

  // Handle answer selection for multiple choice questions
  const handleMultipleChoiceAnswer = (questionId: number, optionId: string) => {
    const currentAnswers = getCurrentAnswers();
    setCurrentAnswers({
      ...currentAnswers,
      [questionId]: optionId
    });
    
    // Add branching logic for specific question (e.g., question 6)
    if (questionId === 6) {
      setHasBranchingQuestion(true);
      if (optionId === 'A') { // Yes
        setBranchingPath('yes-path');
      } else if (optionId === 'B') { // No
        setBranchingPath('no-path');
      }
    }
    
    // Update tag scores
    updateTagScores(questionId, optionId);
    
    // Add new feature: auto-scroll to next question
    setTimeout(() => {
      scrollToNextQuestion(questionId);
    }, 100);
  };

  // Handle text input for free text questions
  const handleTextAnswer = (questionId: number, text: string) => {
    const currentAnswers = getCurrentAnswers();
    // Only update answer when there's text content
    if (text.trim()) {
      setCurrentAnswers({
        ...currentAnswers,
        [questionId]: text
      });
    } else {
      // Remove the answer if text is empty to accurately track progress
      const newAnswers = {...currentAnswers};
      delete newAnswers[questionId];
      setCurrentAnswers(newAnswers);
    }
  };

  // Handle scale question answer
  const handleScaleAnswer = (questionId: number, value: string) => {
    const currentAnswers = getCurrentAnswers();
    setCurrentAnswers({
      ...currentAnswers,
      [questionId]: value
    });
    
    // Update tag scores
    updateTagScores(questionId, value);
    
    // Add new feature: auto-scroll to next question
    setTimeout(() => {
      scrollToNextQuestion(questionId);
    }, 100);
  };

  // Helper to get current answers based on which questionnaire is active
  const getCurrentAnswers = (): Record<number, string> => {
    // When both mother and corporate are selected or 'both' questionnaire is active
    if ((selectedIdentities.has('mother') && selectedIdentities.has('corporate')) || activeQuestionnaire === 'both') {
      return showingPrimaryQuestionnaire ? primaryAnswers : secondaryAnswers;
    }
    return answers;
  };

  // Helper to set current answers based on which questionnaire is active
  const setCurrentAnswers = (newAnswers: Record<number, string>) => {
    // When both mother and corporate are selected or 'both' questionnaire is active
    if ((selectedIdentities.has('mother') && selectedIdentities.has('corporate')) || activeQuestionnaire === 'both') {
      if (showingPrimaryQuestionnaire) {
        setPrimaryAnswers(newAnswers);
      } else {
        setSecondaryAnswers(newAnswers);
      }
    } else {
      setAnswers(newAnswers);
    }
  };

  // Add a method to switch between questionnaires for "both" type
  const switchQuestionnaire = () => {
    if ((selectedIdentities.has('mother') && selectedIdentities.has('corporate')) || activeQuestionnaire === 'both') {
      setShowingPrimaryQuestionnaire(!showingPrimaryQuestionnaire);
      // Reset question index when switching
      setShowFirstPage(true);
      setShowSecondPage(false);
      setShowThirdPage(false);
      // Reset all page visibility states
      setShowFourthPage(false);
      setShowFifthPage(false);
      setShowSixthPage(false);
    }
  };

  const renderQuestionnaireContent = () => {
    if (!activeQuestionnaire) return null;
    const questions = getCurrentQuestions();
    if (!questions || questions.length === 0) return null;

    switch (activeQuestionnaire) {
      case 'mother':
        return renderMotherQuestionnaire(questions);
      case 'corporate':
        return renderCorporateQuestionnaire(questions);
      case 'other':
        return renderOtherQuestionnaire(questions);
      case 'both':
        return renderBothQuestionnaire(questions);
      default:
        return null;
    }
  };

  const renderMotherQuestionnaire = (questions: Question[]) => {
    // Helper function to get questions based on branching logic
    const getQuestionsForCurrentPage = (startIndex: number, endIndex: number) => {
      if (!hasBranchingQuestion || startIndex < 6) {
        // Before branching question, show all questions normally
        return questions.slice(startIndex, endIndex);
      }

      if (startIndex === 6) {
        // Include branching question
        return questions.slice(6, 7);
      }

      if (branchingPath === 'yes-path') {
        // Questions for "yes" path (e.g., 7-10)
        return questions.slice(7, 11);
      }

      if (branchingPath === 'no-path') {
        // Questions for "no" path (e.g., 11-13)
        return questions.slice(11, 14);
      }

      // After branching paths converge (e.g., from question 14 onwards)
      if (startIndex >= 14) {
        return questions.slice(startIndex, endIndex);
      }

      return [];
    };

    return (
      <div className="questionnaire-content mother-questionnaire" lang={language}>
        {/* Progress bar */}
        <div className="question-progress-container">
          <div className="question-progress-bar">
            <div 
              className="question-progress-fill" 
              style={{ width: `${calculatedQuestionnaireProgress()}%` }}
            ></div>
          </div>
        </div>
        
        {/* Show switcher for "both" option */}
        {(selectedIdentities.has('mother') && selectedIdentities.has('corporate')) || activeQuestionnaire === 'both' ? (
          <div className="questionnaire-switcher">
            <button 
              className={`switcher-button ${showingPrimaryQuestionnaire ? 'active' : ''}`}
              onClick={() => {
                if (!showingPrimaryQuestionnaire) switchQuestionnaire();
              }}
            >
              {language === 'en' ? 'Mother Questionnaire' : '母亲问卷'}
            </button>
            <button 
              className={`switcher-button ${!showingPrimaryQuestionnaire ? 'active' : ''}`}
              onClick={() => {
                if (showingPrimaryQuestionnaire) switchQuestionnaire();
              }}
            >
              {language === 'en' ? 'Corporate Questionnaire' : '企业问卷'}
            </button>
          </div>
        ) : null}
        
        {/* 母亲问卷分页内容 */}
        {
          showFirstPage ? (
            // 第1页: 根据分支逻辑获取问题
            <div className="first-page-questions first-page-true">
              {getQuestionsForCurrentPage(0, 10).map((question) => (
                <div key={question.id} id={`question-${question.id}`} className="question-container">
                  {renderQuestionText(question)}
                  
                  {question.type === 'multiple-choice' && (
                    <div className="answer-options">
                      {question.options?.map(option => (
                        <div 
                          key={option.id}
                          className={`answer-option ${getCurrentAnswers()[question.id] === option.id ? 'selected' : ''}`}
                          onClick={() => handleMultipleChoiceAnswer(question.id, option.id)}
                        >
                          <p>{option.id}) {language === 'en' ? option.textEn : option.textZh}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {question.type === 'text-input' && (
                    <div className="text-input-container">
                      <input
                        type="text"
                        className="text-answer-input"
                        value={getCurrentAnswers()[question.id] || ''}
                        onChange={(e) => handleTextAnswer(question.id, e.target.value)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}
                  
                  {question.type === 'scale-question' && (
                    <div className="scale-question-container">
                      <div className="scale-labels-wrapper">
                        <div className="scale-options">
                          {['1', '2', '3', '4', '5'].map((value) => (
                            <div 
                              key={value}
                              className={`scale-option ${getCurrentAnswers()[question.id] === value ? 'selected' : ''}`}
                              onClick={() => handleScaleAnswer(question.id, value)}
                            >
                              <div className="scale-circle"></div>
                              <span className="scale-value">{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="scale-extreme-labels">
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.minEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.minZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.maxEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.maxZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {/* 母亲问卷第一页导航按钮 */}
              <div className="first-page-navigation">
                <button 
                  className="nav-button next-button first-page-continue"
                  onClick={() => {
                    setShowFirstPage(false);
                    setShowThirdPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                  disabled={Object.keys(getCurrentAnswers()).filter(id => parseInt(id) >= 1 && parseInt(id) <= 8).length < 8}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : showThirdPage ? (
            // 第2页: 根据分支逻辑获取问题
            <div className="first-page-questions">
              <h1 className="section-title">
                {language === 'en' 
                  ? 'I. About Work-Life Balance' 
                  : 'I. 关于工作与生活的平衡'}
              </h1>
              
              {getQuestionsForCurrentPage(10, 23).map((question) => (
                <div key={question.id} id={`question-${question.id}`} className="question-container">
                  {renderQuestionText(question)}
                  
                  {question.type === 'multiple-choice' && (
                    <div className="answer-options">
                      {question.options?.map(option => (
                        <div 
                          key={option.id}
                          className={`answer-option ${getCurrentAnswers()[question.id] === option.id ? 'selected' : ''}`}
                          onClick={() => handleMultipleChoiceAnswer(question.id, option.id)}
                        >
                          <p>{option.id}) {language === 'en' ? option.textEn : option.textZh}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {question.type === 'text-input' && (
                    <div className="text-input-container">
                      <input
                        type="text"
                        className="text-answer-input"
                        value={getCurrentAnswers()[question.id] || ''}
                        onChange={(e) => handleTextAnswer(question.id, e.target.value)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}
                  
                  {question.type === 'scale-question' && (
                    <div className="scale-question-container">
                      <div className="scale-labels-wrapper">
                        <div className="scale-options">
                          {['1', '2', '3', '4', '5'].map((value) => (
                            <div 
                              key={value}
                              className={`scale-option ${getCurrentAnswers()[question.id] === value ? 'selected' : ''}`}
                              onClick={() => handleScaleAnswer(question.id, value)}
                            >
                              <div className="scale-circle"></div>
                              <span className="scale-value">{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="scale-extreme-labels">
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.minEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.minZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.maxEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.maxZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              <div className="question-navigation">
                <button 
                  className="nav-button prev-button"
                  onClick={() => {
                    setShowThirdPage(false);
                    setShowFirstPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                >
                  {language === 'en' ? 'Back' : '返回'}
                </button>
                
                <button 
                  className="nav-button next-button"
                  onClick={() => {
                    setShowThirdPage(false);
                    setShowFourthPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                  disabled={Object.keys(getCurrentAnswers()).filter(id => parseInt(id) >= 9 && parseInt(id) <= 21).length < 13}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : showFourthPage ? (
            // 第3页: ID 22-35，标题"II. About Us, CHON / 关于我们"
            <div className="first-page-questions">
              <h1 className="section-title">
                {language === 'en' 
                  ? 'II. About Us, CHON' 
                  : 'II. 关于我们'}
              </h1>
              
              {getQuestionsForCurrentPage(23, 37).map((question) => (
                <div key={question.id} id={`question-${question.id}`} className="question-container">
                  {renderQuestionText(question)}
                  
                  {question.type === 'multiple-choice' && (
                    <div className="answer-options">
                      {question.options?.map(option => (
                        <div 
                          key={option.id}
                          className={`answer-option ${getCurrentAnswers()[question.id] === option.id ? 'selected' : ''}`}
                          onClick={() => handleMultipleChoiceAnswer(question.id, option.id)}
                        >
                          <p>{option.id}) {language === 'en' ? option.textEn : option.textZh}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {question.type === 'text-input' && (
                    <div className="text-input-container">
                      <input
                        type="text"
                        className="text-answer-input"
                        value={getCurrentAnswers()[question.id] || ''}
                        onChange={(e) => handleTextAnswer(question.id, e.target.value)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}
                  
                  {question.type === 'scale-question' && (
                    <div className="scale-question-container">
                      <div className="scale-labels-wrapper">
                        <div className="scale-options">
                          {['1', '2', '3', '4', '5'].map((value) => (
                            <div 
                              key={value}
                              className={`scale-option ${getCurrentAnswers()[question.id] === value ? 'selected' : ''}`}
                              onClick={() => handleScaleAnswer(question.id, value)}
                            >
                              <div className="scale-circle"></div>
                              <span className="scale-value">{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="scale-extreme-labels">
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.minEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.minZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.maxEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.maxZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              <div className="question-navigation">
                <button 
                  className="nav-button prev-button"
                  onClick={() => {
                    setShowFourthPage(false);
                    setShowThirdPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                >
                  {language === 'en' ? 'Back' : '返回'}
                </button>
                
                <button 
                  className="nav-button next-button"
                  onClick={() => {
                    setShowFourthPage(false);
                    setShowFifthPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                  disabled={Object.keys(getCurrentAnswers()).filter(id => parseInt(id) >= 22 && parseInt(id) <= 35).length < 14}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : showFifthPage ? (
            // 第4页: ID 36-48，标题"III. About Motherhood"
            <div className="first-page-questions">
              <h1 className="section-title">
                {language === 'en' 
                  ? 'III. About Motherhood' 
                  : 'III. 关于母亲'}
              </h1>
              
              {getQuestionsForCurrentPage(37, 50).map((question) => (
                <div key={question.id} id={`question-${question.id}`} className="question-container">
                  {renderQuestionText(question)}
                  
                  {question.type === 'multiple-choice' && (
                    <div className="answer-options">
                      {question.options?.map(option => (
                        <div 
                          key={option.id}
                          className={`answer-option ${getCurrentAnswers()[question.id] === option.id ? 'selected' : ''}`}
                          onClick={() => handleMultipleChoiceAnswer(question.id, option.id)}
                        >
                          <p>{option.id}) {language === 'en' ? option.textEn : option.textZh}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {question.type === 'text-input' && (
                    <div className="text-input-container">
                      <input
                        type="text"
                        className="text-answer-input"
                        value={getCurrentAnswers()[question.id] || ''}
                        onChange={(e) => handleTextAnswer(question.id, e.target.value)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}
                  
                  {question.type === 'scale-question' && (
                    <div className="scale-question-container">
                      <div className="scale-labels-wrapper">
                        <div className="scale-options">
                          {['1', '2', '3', '4', '5'].map((value) => (
                            <div 
                              key={value}
                              className={`scale-option ${getCurrentAnswers()[question.id] === value ? 'selected' : ''}`}
                              onClick={() => handleScaleAnswer(question.id, value)}
                            >
                              <div className="scale-circle"></div>
                              <span className="scale-value">{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="scale-extreme-labels">
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.minEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.minZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.maxEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.maxZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              <div className="question-navigation">
                <button 
                  className="nav-button prev-button"
                  onClick={() => {
                    setShowFifthPage(false);
                    setShowFourthPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                >
                  {language === 'en' ? 'Back' : '返回'}
                </button>
                
                <button 
                  className="nav-button finish-button"
                  onClick={() => {
                    // 完成问卷并跳转到结果页面
                    finishQuestionnaire();
                  }}
                  disabled={Object.keys(getCurrentAnswers()).filter(id => parseInt(id) >= 36 && parseInt(id) <= 48).length < 13}
                >
                  {language === 'en' ? 'Finish' : '完成'}
                </button>
              </div>
            </div>
          ) : null
        }
      </div>
    );
  };

  const renderCorporateQuestionnaire = (questions: Question[]) => {
    return (
      <div className="questionnaire-content corporate-questionnaire" lang={language}>
        {/* Progress bar */}
        <div className="question-progress-container">
          <div className="question-progress-bar">
            <div 
              className="question-progress-fill" 
              style={{ width: `${calculatedQuestionnaireProgress()}%` }}
            ></div>
          </div>
        </div>
        
        {/* Show switcher for "both" option */}
        {(selectedIdentities.has('mother') && selectedIdentities.has('corporate')) || activeQuestionnaire === 'both' ? (
          <div className="questionnaire-switcher">
            <button 
              className={`switcher-button ${showingPrimaryQuestionnaire ? 'active' : ''}`}
              onClick={() => {
                if (!showingPrimaryQuestionnaire) switchQuestionnaire();
              }}
            >
              {language === 'en' ? 'Mother Questionnaire' : '母亲问卷'}
            </button>
            <button 
              className={`switcher-button ${!showingPrimaryQuestionnaire ? 'active' : ''}`}
              onClick={() => {
                if (showingPrimaryQuestionnaire) switchQuestionnaire();
              }}
            >
              {language === 'en' ? 'Corporate Questionnaire' : '企业问卷'}
            </button>
          </div>
        ) : null}
        
        {/* 企业问卷分页内容 */}
        {
          showFirstPage ? (
            // 第1页: ID 1-12，无标题
            <div className="first-page-questions first-page-true">
              {questions.slice(0, 12).map((question) => (
                <div key={question.id} id={`question-${question.id}`} className="question-container">
                  {renderQuestionText(question)}
                  
                  {question.type === 'multiple-choice' && (
                    <div className="answer-options">
                      {question.options?.map(option => (
                        <div 
                          key={option.id}
                          className={`answer-option ${getCurrentAnswers()[question.id] === option.id ? 'selected' : ''}`}
                          onClick={() => handleMultipleChoiceAnswer(question.id, option.id)}
                        >
                          <p>{option.id}) {language === 'en' ? option.textEn : option.textZh}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {question.type === 'text-input' && (
                    <div className="text-input-container">
                      <input
                        type="text"
                        className="text-answer-input"
                        value={getCurrentAnswers()[question.id] || ''}
                        onChange={(e) => handleTextAnswer(question.id, e.target.value)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}
                  
                  {question.type === 'scale-question' && (
                    <div className="scale-question-container">
                      <div className="scale-labels-wrapper">
                        <div className="scale-options">
                          {['1', '2', '3', '4', '5'].map((value) => (
                            <div 
                              key={value}
                              className={`scale-option ${getCurrentAnswers()[question.id] === value ? 'selected' : ''}`}
                              onClick={() => handleScaleAnswer(question.id, value)}
                            >
                              <div className="scale-circle"></div>
                              <span className="scale-value">{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="scale-extreme-labels">
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.minEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.minZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.maxEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.maxZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              <div className="first-page-navigation">
                <button 
                  className="nav-button next-button first-page-continue"
                  onClick={() => {
                    setShowFirstPage(false);
                    setShowSecondPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                  disabled={Object.keys(getCurrentAnswers()).filter(id => parseInt(id) >= 1 && parseInt(id) <= 7).length < 7}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : showSecondPage ? (
            // 第2页: ID 8-21，标题"I. 关于您的领导力 / About Your Leadership"
            <div className="first-page-questions">
              <h1 className="section-title">
                {language === 'en' 
                  ? 'I. About Your Leadership' 
                  : 'I. 关于您的领导力'}
              </h1>
              
              {questions.slice(12, 26).map((question) => (
                <div key={question.id} id={`question-${question.id}`} className="question-container">
                  {renderQuestionText(question)}
                  
                  {question.type === 'multiple-choice' && (
                    <div className="answer-options">
                      {question.options?.map(option => (
                        <div 
                          key={option.id}
                          className={`answer-option ${getCurrentAnswers()[question.id] === option.id ? 'selected' : ''}`}
                          onClick={() => handleMultipleChoiceAnswer(question.id, option.id)}
                        >
                          <p>{option.id}) {language === 'en' ? option.textEn : option.textZh}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {question.type === 'text-input' && (
                    <div className="text-input-container">
                      <input
                        type="text"
                        className="text-answer-input"
                        value={getCurrentAnswers()[question.id] || ''}
                        onChange={(e) => handleTextAnswer(question.id, e.target.value)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}
                  
                  {question.type === 'scale-question' && (
                    <div className="scale-question-container">
                      <div className="scale-labels-wrapper">
                        <div className="scale-options">
                          {['1', '2', '3', '4', '5'].map((value) => (
                            <div 
                              key={value}
                              className={`scale-option ${getCurrentAnswers()[question.id] === value ? 'selected' : ''}`}
                              onClick={() => handleScaleAnswer(question.id, value)}
                            >
                              <div className="scale-circle"></div>
                              <span className="scale-value">{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="scale-extreme-labels">
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.minEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.minZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.maxEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.maxZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              <div className="question-navigation">
                <button 
                  className="nav-button prev-button"
                  onClick={() => {
                    setShowSecondPage(false);
                    setShowFirstPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                >
                  {language === 'en' ? 'Back' : '返回'}
                </button>
                
                <button 
                  className="nav-button next-button"
                  onClick={() => {
                    setShowSecondPage(false);
                    setShowThirdPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                  disabled={Object.keys(getCurrentAnswers()).filter(id => parseInt(id) >= 8 && parseInt(id) <= 21).length < 14}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : showThirdPage ? (
            // 第3页: ID 22-36，标题"II. About Us, CHON / 关于我们"
            <div className="first-page-questions">
              <h1 className="section-title">
                {language === 'en' 
                  ? 'II. About Us, CHON' 
                  : 'II. 关于我们'}
              </h1>
              
              {questions.slice(26, 41).map((question) => (
                <div key={question.id} id={`question-${question.id}`} className="question-container">
                  {renderQuestionText(question)}
                  
                  {question.type === 'multiple-choice' && (
                    <div className="answer-options">
                      {question.options?.map(option => (
                        <div 
                          key={option.id}
                          className={`answer-option ${getCurrentAnswers()[question.id] === option.id ? 'selected' : ''}`}
                          onClick={() => handleMultipleChoiceAnswer(question.id, option.id)}
                        >
                          <p>{option.id}) {language === 'en' ? option.textEn : option.textZh}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {question.type === 'text-input' && (
                    <div className="text-input-container">
                      <input
                        type="text"
                        className="text-answer-input"
                        value={getCurrentAnswers()[question.id] || ''}
                        onChange={(e) => handleTextAnswer(question.id, e.target.value)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}
                  
                  {question.type === 'scale-question' && (
                    <div className="scale-question-container">
                      <div className="scale-labels-wrapper">
                        <div className="scale-options">
                          {['1', '2', '3', '4', '5'].map((value) => (
                            <div 
                              key={value}
                              className={`scale-option ${getCurrentAnswers()[question.id] === value ? 'selected' : ''}`}
                              onClick={() => handleScaleAnswer(question.id, value)}
                            >
                              <div className="scale-circle"></div>
                              <span className="scale-value">{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="scale-extreme-labels">
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.minEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.minZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.maxEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.maxZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              <div className="question-navigation">
                <button 
                  className="nav-button prev-button"
                  onClick={() => {
                    setShowThirdPage(false);
                    setShowSecondPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                >
                  {language === 'en' ? 'Back' : '返回'}
                </button>
                
                <button 
                  className="nav-button next-button"
                  onClick={() => {
                    setShowThirdPage(false);
                    setShowFourthPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                  disabled={Object.keys(getCurrentAnswers()).filter(id => parseInt(id) >= 22 && parseInt(id) <= 36).length < 15}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : showFourthPage ? (
            // 第4页: ID 37-47，标题"III. About Motherhood 关于母亲"
            <div className="first-page-questions">
              <h1 className="section-title">
                {language === 'en' 
                  ? 'III. About Motherhood' 
                  : 'III. 关于母亲'}
              </h1>
              
              {questions.slice(41, 52).map((question) => (
                <div key={question.id} id={`question-${question.id}`} className="question-container">
                  {renderQuestionText(question)}
                  
                  {question.type === 'multiple-choice' && (
                    <div className="answer-options">
                      {question.options?.map(option => (
                        <div 
                          key={option.id}
                          className={`answer-option ${getCurrentAnswers()[question.id] === option.id ? 'selected' : ''}`}
                          onClick={() => handleMultipleChoiceAnswer(question.id, option.id)}
                        >
                          <p>{option.id}) {language === 'en' ? option.textEn : option.textZh}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {question.type === 'text-input' && (
                    <div className="text-input-container">
                      <input
                        type="text"
                        className="text-answer-input"
                        value={getCurrentAnswers()[question.id] || ''}
                        onChange={(e) => handleTextAnswer(question.id, e.target.value)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}
                  
                  {question.type === 'scale-question' && (
                    <div className="scale-question-container">
                      <div className="scale-labels-wrapper">
                        <div className="scale-options">
                          {['1', '2', '3', '4', '5'].map((value) => (
                            <div 
                              key={value}
                              className={`scale-option ${getCurrentAnswers()[question.id] === value ? 'selected' : ''}`}
                              onClick={() => handleScaleAnswer(question.id, value)}
                            >
                              <div className="scale-circle"></div>
                              <span className="scale-value">{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="scale-extreme-labels">
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.minEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.minZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.maxEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.maxZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              <div className="question-navigation">
                <button 
                  className="nav-button prev-button"
                  onClick={() => {
                    setShowFourthPage(false);
                    setShowThirdPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                >
                  {language === 'en' ? 'Back' : '返回'}
                </button>
                
                <button 
                  className="nav-button finish-button"
                  onClick={() => {
                    // 完成问卷并跳转到结果页面
                    finishQuestionnaire();
                  }}
                  disabled={Object.keys(getCurrentAnswers()).filter(id => parseInt(id) >= 32 && parseInt(id) <= 42).length < 11}
                >
                  {language === 'en' ? 'Finish' : '完成'}
                </button>
              </div>
            </div>
          ) : null
        }
      </div>
    );
  };

  const renderOtherQuestionnaire = (questions: Question[]) => {
    return (
      <div className="questionnaire-content other-questionnaire" lang={language}>
        {/* Progress bar */}
        <div className="question-progress-container">
          <div className="question-progress-bar">
            <div 
              className="question-progress-fill" 
              style={{ width: `${calculatedQuestionnaireProgress()}%` }}
            ></div>
          </div>
        </div>
        
        {/* 其他问卷分页内容 */}
        {
          showFirstPage ? (
            // 第1页: ID 1-4，无标题
            <div className="first-page-questions first-page-true">
              {questions.slice(0, 4).map((question) => (
                <div key={question.id} id={`question-${question.id}`} className="question-container">
                  {renderQuestionText(question)}
                  
                  {question.type === 'multiple-choice' && (
                    <div className="answer-options">
                      {question.options?.map(option => (
                        <div 
                          key={option.id}
                          className={`answer-option ${getCurrentAnswers()[question.id] === option.id ? 'selected' : ''}`}
                          onClick={() => handleMultipleChoiceAnswer(question.id, option.id)}
                        >
                          <p>{option.id}) {language === 'en' ? option.textEn : option.textZh}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {question.type === 'text-input' && (
                    <div className="text-input-container">
                      <input
                        type="text"
                        className="text-answer-input"
                        value={getCurrentAnswers()[question.id] || ''}
                        onChange={(e) => handleTextAnswer(question.id, e.target.value)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}
                  
                  {question.type === 'scale-question' && (
                    <div className="scale-question-container">
                      <div className="scale-labels-wrapper">
                        <div className="scale-options">
                          {['1', '2', '3', '4', '5'].map((value) => (
                            <div 
                              key={value}
                              className={`scale-option ${getCurrentAnswers()[question.id] === value ? 'selected' : ''}`}
                              onClick={() => handleScaleAnswer(question.id, value)}
                            >
                              <div className="scale-circle"></div>
                              <span className="scale-value">{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="scale-extreme-labels">
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.minEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.minZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.maxEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.maxZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              <div className="question-navigation">
                <button 
                  className="nav-button next-button"
                  onClick={() => {
                    setShowFirstPage(false);
                    setShowSecondPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                  disabled={Object.keys(getCurrentAnswers()).filter(id => parseInt(id) >= 1 && parseInt(id) <= 4).length < 4}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : showSecondPage ? (
            // 第2页: ID 5-15，标题"I. About Professional Work / 关于职业工作"
            <div className="first-page-questions">
              <h1 className="section-title">
                {language === 'en' 
                  ? 'I. About Professional Work' 
                  : 'I. 关于职业工作'}
              </h1>
              
              {questions.slice(4, 15).map((question) => (
                <div key={question.id} id={`question-${question.id}`} className="question-container">
                  {renderQuestionText(question)}
                  
                  {question.type === 'multiple-choice' && (
                    <div className="answer-options">
                      {question.options?.map(option => (
                        <div 
                          key={option.id}
                          className={`answer-option ${getCurrentAnswers()[question.id] === option.id ? 'selected' : ''}`}
                          onClick={() => handleMultipleChoiceAnswer(question.id, option.id)}
                        >
                          <p>{option.id}) {language === 'en' ? option.textEn : option.textZh}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {question.type === 'text-input' && (
                    <div className="text-input-container">
                      <input
                        type="text"
                        className="text-answer-input"
                        value={getCurrentAnswers()[question.id] || ''}
                        onChange={(e) => handleTextAnswer(question.id, e.target.value)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}
                  
                  {question.type === 'scale-question' && (
                    <div className="scale-question-container">
                      <div className="scale-labels-wrapper">
                        <div className="scale-options">
                          {['1', '2', '3', '4', '5'].map((value) => (
                            <div 
                              key={value}
                              className={`scale-option ${getCurrentAnswers()[question.id] === value ? 'selected' : ''}`}
                              onClick={() => handleScaleAnswer(question.id, value)}
                            >
                              <div className="scale-circle"></div>
                              <span className="scale-value">{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="scale-extreme-labels">
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.minEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.minZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.maxEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.maxZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              <div className="question-navigation">
                <button 
                  className="nav-button prev-button"
                  onClick={() => {
                    setShowSecondPage(false);
                    setShowFirstPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                >
                  {language === 'en' ? 'Back' : '返回'}
                </button>
                
                <button 
                  className="nav-button next-button"
                  onClick={() => {
                    setShowSecondPage(false);
                    setShowThirdPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                  disabled={Object.keys(getCurrentAnswers()).filter(id => parseInt(id) >= 5 && parseInt(id) <= 15).length < 11}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : showThirdPage ? (
            // 第3页: ID 16-30，标题"II. About Us, CHON / 关于我们"
            <div className="first-page-questions">
              <h1 className="section-title">
                {language === 'en' 
                  ? 'II. About Us, CHON' 
                  : 'II. 关于我们'}
              </h1>
              
              {questions.slice(15, 30).map((question) => (
                <div key={question.id} id={`question-${question.id}`} className="question-container">
                  {renderQuestionText(question)}
                  
                  {question.type === 'multiple-choice' && (
                    <div className="answer-options">
                      {question.options?.map(option => (
                        <div 
                          key={option.id}
                          className={`answer-option ${getCurrentAnswers()[question.id] === option.id ? 'selected' : ''}`}
                          onClick={() => handleMultipleChoiceAnswer(question.id, option.id)}
                        >
                          <p>{option.id}) {language === 'en' ? option.textEn : option.textZh}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {question.type === 'text-input' && (
                    <div className="text-input-container">
                      <input
                        type="text"
                        className="text-answer-input"
                        value={getCurrentAnswers()[question.id] || ''}
                        onChange={(e) => handleTextAnswer(question.id, e.target.value)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}
                  
                  {question.type === 'scale-question' && (
                    <div className="scale-question-container">
                      <div className="scale-labels-wrapper">
                        <div className="scale-options">
                          {['1', '2', '3', '4', '5'].map((value) => (
                            <div 
                              key={value}
                              className={`scale-option ${getCurrentAnswers()[question.id] === value ? 'selected' : ''}`}
                              onClick={() => handleScaleAnswer(question.id, value)}
                            >
                              <div className="scale-circle"></div>
                              <span className="scale-value">{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="scale-extreme-labels">
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.minEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.minZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.maxEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.maxZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              <div className="question-navigation">
                <button 
                  className="nav-button prev-button"
                  onClick={() => {
                    setShowThirdPage(false);
                    setShowSecondPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                >
                  {language === 'en' ? 'Back' : '返回'}
                </button>
                
                <button 
                  className="nav-button next-button"
                  onClick={() => {
                    setShowThirdPage(false);
                    setShowFourthPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                  disabled={Object.keys(getCurrentAnswers()).filter(id => parseInt(id) >= 16 && parseInt(id) <= 30).length < 15}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : showFourthPage ? (
            // 第4页: ID 31-41，标题"III. About Motherhood / 关于母亲"
            <div className="first-page-questions">
              <h1 className="section-title">
                {language === 'en' 
                  ? 'III. About Motherhood' 
                  : 'III. 关于母亲'}
              </h1>
              
              {questions.slice(30, 41).map((question) => (
                <div key={question.id} id={`question-${question.id}`} className="question-container">
                  {renderQuestionText(question)}
                  
                  {question.type === 'multiple-choice' && (
                    <div className="answer-options">
                      {question.options?.map(option => (
                        <div 
                          key={option.id}
                          className={`answer-option ${getCurrentAnswers()[question.id] === option.id ? 'selected' : ''}`}
                          onClick={() => handleMultipleChoiceAnswer(question.id, option.id)}
                        >
                          <p>{option.id}) {language === 'en' ? option.textEn : option.textZh}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {question.type === 'text-input' && (
                    <div className="text-input-container">
                      <input
                        type="text"
                        className="text-answer-input"
                        value={getCurrentAnswers()[question.id] || ''}
                        onChange={(e) => handleTextAnswer(question.id, e.target.value)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}
                  
                  {question.type === 'scale-question' && (
                    <div className="scale-question-container">
                      <div className="scale-labels-wrapper">
                        <div className="scale-options">
                          {['1', '2', '3', '4', '5'].map((value) => (
                            <div 
                              key={value}
                              className={`scale-option ${getCurrentAnswers()[question.id] === value ? 'selected' : ''}`}
                              onClick={() => handleScaleAnswer(question.id, value)}
                            >
                              <div className="scale-circle"></div>
                              <span className="scale-value">{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="scale-extreme-labels">
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.minEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.minZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.maxEn.split(' – ').map((part, i) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.maxZh.split(' – ').map((part, i) => <span key={i}>{part}</span>)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              <div className="question-navigation">
                <button 
                  className="nav-button prev-button"
                  onClick={() => {
                    setShowFourthPage(false);
                    setShowThirdPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                >
                  {language === 'en' ? 'Back' : '返回'}
                </button>
                
                <button 
                  className="nav-button finish-button"
                  onClick={() => {
                    // 完成问卷并跳转到结果页面
                    finishQuestionnaire();
                  }}
                  disabled={Object.keys(getCurrentAnswers()).filter(id => parseInt(id) >= 31 && parseInt(id) <= 41).length < 11}
                >
                  {language === 'en' ? 'Finish' : '完成'}
                </button>
              </div>
            </div>
          ) : null
        }
      </div>
    );
  };

  const renderBothQuestionnaire = (questions: Question[]) => {
    return (
      <BothQuestionnaire
        language={language}
        getCurrentAnswers={getCurrentAnswers}
        handleMultipleChoiceAnswer={handleMultipleChoiceAnswer}
        handleTextAnswer={handleTextAnswer}
        handleScaleAnswer={handleScaleAnswer}
        showFirstPage={showFirstPage}
        showSecondPage={showSecondPage}
        showThirdPage={showThirdPage}
        showFourthPage={showFourthPage}
        showFifthPage={showFifthPage}
        showSixthPage={showSixthPage}
        setShowFirstPage={setShowFirstPage}
        setShowSecondPage={setShowSecondPage}
        setShowThirdPage={setShowThirdPage}
        setShowFourthPage={setShowFourthPage}
        setShowFifthPage={setShowFifthPage}
        setShowSixthPage={setShowSixthPage}
        scrollToFirstQuestionOfNextPage={scrollToFirstQuestionOfNextPage}
        calculatedQuestionnaireProgress={calculatedQuestionnaireProgress}
        finishQuestionnaire={finishQuestionnaire}
      />
    );
  };

  // 完成问卷并跳转到结果页面的函数
  const finishQuestionnaire = () => {
    // 计算结果并保存
    calculateTagResults();
    
    // 准备提交到后端的回答数据
    let allResponses: QuestionResponse[] = [];
    
    if (activeQuestionnaire === 'both') {
      // 对于'both'问卷，收集主要和次要回答
      const primaryQuestions = questionnaires.both.questions;
      const primaryResponses = prepareQuestionResponses('both', primaryQuestions, primaryAnswers);
      const secondaryResponses = prepareQuestionResponses('both', primaryQuestions, secondaryAnswers);
      
      allResponses = [...primaryResponses, ...secondaryResponses];
    } else if (activeQuestionnaire) {
      // 对于单一问卷
      const questions = questionnaires[activeQuestionnaire].questions;
      const currentQuestionnaire = questionnaires[activeQuestionnaire];
      // 使用uniqueIdMapping（如果存在）
      allResponses = prepareQuestionResponses(
        activeQuestionnaire, 
        questions, 
        answers,
        currentQuestionnaire.uniqueIdMapping
      );
    }
    
    // 一次性保存所有回答
    questionnaireApi.saveAllQuestionResponses(allResponses)
      .then(() => {
        // 保存成功后跳转到结果页面
        navigate('/results');
      })
      .catch((error) => {
        console.error('Error during questionnaire completion:', error);
        // 即使保存失败，仍然跳转到结果页面
        navigate('/results');
      });
  };

  // Exit button that appears only on questionnaire and privacy screens
  const handleExit = (e: React.MouseEvent) => {
    // 添加确认对话框
    const confirmExit = window.confirm(
      language === 'en' 
        ? 'Are you sure you want to exit? All progress will be lost.'
        : '确定要退出吗？所有进度将会丢失。'
    );
    
    if (!confirmExit) {
      e.preventDefault(); // 阻止导航
      return;
    }
    
    // 清空所有localStorage数据
    localStorage.clear();
    
    console.log('已清空所有测试数据');
  };

  const exitButton = (
    <div className="exit-actions">
      <Link to="/" className="exit-button" lang={language} onClick={handleExit}>
        {language === 'en' ? '← Exit' : '← 退出'}
      </Link>
    </div>
  );

  // Only white theme steps should have no-header class
  const containerClass = step === 'privacy' || step === 'questionnaire' 
    ? 'personality-test-container no-header' 
    : 'personality-test-container';

  // 计算问卷进度
  const calculatedQuestionnaireProgress = () => {
    // For "both" option, calculate progress based on active questionnaire
    const answeredCount = Object.keys(getCurrentAnswers()).length;
    const total = getTotalQuestions();
    return total > 0 ? (answeredCount / total) * 100 : 0;
  };

  // 在intro页面确保显示问题和选项
  const renderIntroContent = () => {
    const wrappedQuestion = `<span lang="${language}">${language === 'en' ? t.intro.question : '母亲是天生的领导者。'}</span>`;
    
    return (
      <div className="intro-content" lang={language}>
        <h1 className="intro-question" 
            dangerouslySetInnerHTML={{ __html: wrappedQuestion }}
            lang={language}>
        </h1>
        
        {!userChoice ? (
          <div className="test-options" lang={language}>
            <button 
              className="test-option-button"
              onClick={() => handleOptionClick('yes')}
              lang={language}
            >
              {t.intro.yes}
            </button>
            <button 
              className="test-option-button"
              onClick={() => handleOptionClick('no')}
              lang={language}
            >
              {t.intro.no}
            </button>
          </div>
        ) : (
          <>
            <div className="progress-container" lang={language}>
              <div className="percentage-labels" lang={language}>
                <span className="agree-label" lang={language}>
                  {t.intro.agree} ({introStats.yesPercentage}%)
                </span>
                <span className="disagree-label" lang={language}>
                  {t.intro.disagree} ({100 - introStats.yesPercentage}%)
                </span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${introStats.yesPercentage}%` }}
                ></div>
              </div>
              {introStats.loading && (
                <div className="loading-indicator">
                  {language === 'en' ? 'Loading stats...' : '加载统计数据...'}
                </div>
              )}
            </div>
            
            <button 
              className="begin-test-button" 
              onClick={handleBeginTest}
              lang={language}
            >
              {t.intro.beginTest}
            </button>
          </>
        )}
      </div>
    );
  };

  // Render the identity selection UI
  const renderIdentitySelection = () => {
    return (
      <div className="identity-selection" lang={language}>
        {!showCorporateRoles && (
          <h1 className="identity-title" lang={language}>{t.personalityTest.identity.title}</h1>
        )}

        {/* Identity selection as circles */}
        <div className="identity-circles" lang={language}>
          {!showCorporateRoles && (
            <div 
              className={`identity-circle mother ${isIdentitySelected('mother') ? 'selected' : ''}`}
              onClick={() => handleIdentitySelect('mother')}
            >
              <span>{t.personalityTest.identity.mother}</span>
            </div>
          )}

          {!showCorporateRoles ? (
            <div 
              className={`identity-circle corporate ${isIdentitySelected('corporate') ? 'selected' : ''}`}
              onClick={() => {
                if (isIdentitySelected('corporate')) {
                  // If already selected, toggle off
                  handleIdentitySelect('corporate');
                } else {
                  // If not selected, select and show roles
                  handleIdentitySelect('corporate');
                  setShowCorporateRoles(true);
                }
              }}
            >
              <span>{t.personalityTest.identity.corporate}</span>
            </div>
          ) : (
            <div className="corporate-roles-container">
              <div className="corporate-roles-inline" lang={language}>
                {(language === 'en' ? corporateRolesEn : corporateRolesZh).map((role) => (
                  <div
                    key={role}
                    className={`corporate-role-circle ${selectedCorporateRole === role ? 'selected' : ''}`}
                    onClick={() => {
                      if (!isIdentitySelected('corporate')) {
                        handleIdentitySelect('corporate');
                      }
                      setSelectedCorporateRole(role);
                    }}
                  >
                    <span>{role}</span>
                  </div>
                ))}
              </div>
              
              {/* Actions row with Back and Continue when roles are shown */}
              <div className="identity-actions">
                <button 
                  className="continue-button"
                  onClick={() => {
                    setShowCorporateRoles(false);
                    setSelectedCorporateRole(null);
                    // Unselect corporate if no role was selected
                    if (!selectedCorporateRole) {
                      handleIdentitySelect('corporate');
                    }
                  }}
                  lang={language}
                >
                  {language === 'en' ? '← Back' : '← 返回'}
                </button>
                <button 
                  className="continue-button"
                  onClick={() => {
                    // If corporate selected but no specific role chosen, don't proceed
                    if (isIdentitySelected('corporate') && !selectedCorporateRole) {
                      return; // Stay on corporate roles selection
                    }
                    handleContinue();
                  }}
                  disabled={selectedIdentities.size === 0 || (isIdentitySelected('corporate') && !selectedCorporateRole)}
                  lang={language}
                  style={{ display: selectedCorporateRole ? 'block' : 'none' }}
                >
                  {language === 'en' ? 'CONTINUE →' : '继续 →'}
                </button>
              </div>
            </div>
          )}
          
          {!showCorporateRoles && (
            <div 
              className={`identity-circle other ${isIdentitySelected('other') ? 'selected' : ''}`}
              onClick={() => handleIdentitySelect('other')}
            >
              <span>{t.personalityTest.identity.other}</span>
            </div>
          )}
        </div>

        {/* other handled as circle above; no bar rendering here */}

        {!showCorporateRoles && (
          <button 
            className="continue-button"
            onClick={handleContinue}
            disabled={selectedIdentities.size === 0}
            lang={language}
            style={{ display: (selectedIdentities.has('mother') || selectedIdentities.has('other')) ? 'block' : 'none' }}
          >
            {language === 'en' ? 'CONTINUE →' : '继续 →'}
          </button>
        )}
      </div>
    );
  };

  // 在多个地方复用的问题文本渲染函数
  const renderQuestionText = (question: Question) => {
    return (
      <h2 className="question-text">
        {language === 'en' ? question.textEn : question.textZh}
        {/* 标签不再前端显示，但数据仍保留在question对象中用于后续分析 */}
      </h2>
    );
  };

  // 当用户回答问题时，更新相应标签的得分
  const updateTagScores = (questionId: number, value: string) => {
    const question = getCurrentQuestions().find(q => q.id === questionId);
    if (!question || !question.tags || question.tags.length === 0) return;
    
    console.log(`处理问题 ${questionId} 的回答，值: ${value}, 类型: ${question.type}`);
    
    // 对于量表问题，处理分数转换
    let score: number;
    if (question.type === 'scale-question') {
      if (['A', 'B', 'C', 'D', 'E'].includes(value)) {
        // 从"A"到"E"映射为1到5的分数
        const scoreMap: Record<string, number> = {'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5};
        score = scoreMap[value] || 0;
      } else {
        // 直接将数字字符串转换为数字
        score = parseInt(value, 10) || 0;
      }
      
      console.log(`问题 ${questionId} 的分数已转换: ${value} -> ${score}`);
    } else {
      // 对于多选题，暂时只记录选择了哪个选项，不计算分数
      score = 0;
    }
    
    // 为每个标签更新分数
    const newTagScores = {...tagScores};
    
    // 创建问题ID到分数的映射
    const questionScoreMap: Record<string, Record<number, number>> = {};
    
    // 从localStorage加载现有的问题ID-分数映射
    question.tags.forEach(tag => {
      const savedMap = localStorage.getItem(`questionScores_${tag}`);
      if (savedMap) {
        try {
          questionScoreMap[tag] = JSON.parse(savedMap);
        } catch (e) {
          console.error(`解析标签 ${tag} 的问题分数映射出错:`, e);
          questionScoreMap[tag] = {};
        }
      } else {
        questionScoreMap[tag] = {};
      }
      
      // 更新当前问题的分数
      questionScoreMap[tag][questionId] = score;
      
      // 保存更新后的映射
      localStorage.setItem(`questionScores_${tag}`, JSON.stringify(questionScoreMap[tag]));
      
      // 将所有问题的分数转换为数组
      if (!newTagScores[tag]) {
        newTagScores[tag] = [];
      }
      
      // 将问题分数映射的值填入数组
      const scoreArray = Object.values(questionScoreMap[tag]);
      newTagScores[tag] = scoreArray;
      
      console.log(`更新标签 ${tag} 的分数，问题 ${questionId}: ${score}`);
      console.log(`标签 ${tag} 的问题-分数映射:`, questionScoreMap[tag]);
    });
    
    setTagScores(newTagScores);
    
    // 保存标签分数到本地存储
    localStorage.setItem('tagScores', JSON.stringify(newTagScores));
    
    // 计算并保存标签总分和比例
    calculateAndSaveTagStats(newTagScores);
    
    console.log(`标签分数已更新并保存:`, newTagScores);
  };

  // 计算并保存每个标签的统计数据（总分、平均分、比例等）
  const calculateAndSaveTagStats = (currentTagScores: Record<string, number[]>) => {
    // 定义标签统计数据结构
    interface TagStats {
      userScore: number;      // 用户实际得分
      totalPossibleScore: number; // 标签总满分
      scorePercentage: number;   // 得分比例
      averageScore: number;    // 平均分
      answeredQuestions: number; // 已回答问题数
    }
    
    const tagStats: Record<string, TagStats> = {};
    const allTags = ['自我意识', '奉献精神', '社交情商', '情绪调节', '客观能力', '核心耐力'];
    
    // 计算每个标签下有多少量表问题
    const tagQuestionCounts: Record<string, number> = {};
    const questions = getCurrentQuestions();
    
    questions.forEach(question => {
      if (question.type === 'scale-question' && question.tags) {
        question.tags.forEach(tag => {
          if (!tagQuestionCounts[tag]) {
            tagQuestionCounts[tag] = 0;
          }
          tagQuestionCounts[tag] += 1;
        });
      }
    });
    
    // 计算每个标签的统计数据
    allTags.forEach(tag => {
      const scores = currentTagScores[tag] || [];
      // 只计算有效分数（大于0的分数）
      const validScores = scores.filter(score => score > 0);
      const userScore = validScores.reduce((sum, score) => sum + score, 0);
      const answeredQuestions = validScores.length;
      const totalPossibleQuestions = tagQuestionCounts[tag] || 0;
      const totalPossibleScore = totalPossibleQuestions * 5; // 每个问题最高5分
      const scorePercentage = totalPossibleScore > 0 ? (userScore / totalPossibleScore) * 100 : 0;
      const averageScore = answeredQuestions > 0 ? userScore / answeredQuestions : 0;
      
      tagStats[tag] = {
        userScore,
        totalPossibleScore,
        scorePercentage,
        averageScore,
        answeredQuestions
      };
    });
    
    // 保存标签统计数据到本地存储
    localStorage.setItem('tagStats', JSON.stringify(tagStats));
    
    // 打印统计信息的表格
    console.log('==== 标签得分统计 ====');
    console.table(tagStats);
    
    return tagStats;
  };

  // 获取标签统计数据
  const getTagStats = (): Record<string, any> => {
    const savedStats = localStorage.getItem('tagStats');
    if (savedStats) {
      try {
        return JSON.parse(savedStats);
      } catch (e) {
        console.error('Error parsing saved tag statistics:', e);
        return {};
      }
    }
    return {};
  };

  // 在useEffect中添加从localStorage读取标签得分和统计数据的代码
  useEffect(() => {
    // 定义所有标签
    const allTags = ['自我意识', '奉献精神', '社交情商', '情绪调节', '客观能力', '核心耐力'];
    const loadedTagScores: Record<string, number[]> = {};
    
    // 从问题分数映射中加载标签分数
    allTags.forEach(tag => {
      const savedMap = localStorage.getItem(`questionScores_${tag}`);
      if (savedMap) {
        try {
          const questionScoreMap = JSON.parse(savedMap);
          // 将问题分数映射的值填入数组
          loadedTagScores[tag] = Object.values(questionScoreMap);
          console.log(`成功加载标签 ${tag} 的问题分数映射:`, questionScoreMap);
        } catch (e) {
          console.error(`解析标签 ${tag} 的问题分数映射出错:`, e);
          loadedTagScores[tag] = [];
        }
      } else {
        // 尝试从旧格式加载
        const savedTagScores = localStorage.getItem('tagScores');
        if (savedTagScores) {
          try {
            const parsedScores = JSON.parse(savedTagScores);
            if (parsedScores[tag]) {
              loadedTagScores[tag] = parsedScores[tag];
            } else {
              loadedTagScores[tag] = [];
            }
          } catch (e) {
            console.error('解析旧格式标签分数出错:', e);
            loadedTagScores[tag] = [];
          }
        }
      }
    });
    
    // 设置加载的标签分数
    if (Object.keys(loadedTagScores).length > 0) {
      setTagScores(loadedTagScores);
      console.log('成功加载所有标签分数:', loadedTagScores);
      
      // 如果有标签分数但没有统计数据，重新计算一次
      if (!localStorage.getItem('tagStats')) {
        calculateAndSaveTagStats(loadedTagScores);
      }
    }
  }, []);

  // 计算每个标签的总分和平均分
  const calculateTagResults = () => {
    const results: Record<string, {total: number, average: number, count: number}> = {};
    
    Object.entries(tagScores).forEach(([tag, scores]) => {
      // 过滤掉0分(未计分的多选题)
      const validScores = scores.filter(score => score > 0);
      const total = validScores.reduce((sum, score) => sum + score, 0);
      const count = validScores.length;
      const average = count > 0 ? total / count : 0;
      
      results[tag] = {
        total,
        average,
        count
      };
    });
    
    return results;
  };

  // 导出结果的函数，可以在需要导出用户结果时调用
  const exportResults = () => {
    const tagResults = calculateTagResults();
    const allAnswers = {
      primary: primaryAnswers,
      secondary: secondaryAnswers
    };
    
    // 在这里你可以加入导出逻辑，例如发送到服务器或下载为文件
    console.log('Tag Results:', tagResults);
    console.log('All Answers:', allAnswers);
    
    // 示例：将结果转换为JSON并下载
    const resultsBlob = new Blob(
      [JSON.stringify({ tagResults, allAnswers }, null, 2)], 
      { type: 'application/json' }
    );
    
    const url = URL.createObjectURL(resultsBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `personality_test_results_${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderPrivacyStatement = () => {
    const currentQuestionnaire = getCurrentQuestionnaire();
    
    if (!currentQuestionnaire) {
      return null;
    }
    
    // 根据问卷类型添加相应的CSS类
    const privacyClass = currentQuestionnaire.type === 'other' ? 'other-privacy' : 'mother-privacy';
    
    // 添加换行的隐私文本 - 英文版本
    const privacyTextEn = "<strong style=\"font-size: 1.2em;\">Data Usage and Privacy Statement</strong><br><br>At CHON, your privacy is fundamental. We only collect the information necessary to deliver meaningful insights, and we protect it with the highest standards of security and integrity.<br><br><hr><br><br><strong style=\"font-size: 1.2em;\">For Individual Participants</strong><br><br>Your personal information will be used solely for the following purposes:<br><ul><li>To verify your eligibility for specific sections of the survey</li><li>To support demographic and statistical analysis across participant groups</li><li>To generate your personalized CHON personality profile</li></ul>";
    
    // 中文版本的隐私文本 - 优化中文段落结构
    const privacyTextZh = "<strong style=\"font-size: 1.2em;\">数据使用与隐私声明</strong><br><br>在 CHON，我们将您的隐私视为基本原则。我们仅收集实现分析目的所必需的信息，并以最高标准保障数据的安全与完整性。<br><br><hr><br><br><strong style=\"font-size: 1.2em;\">针对个人参与者</strong><br><br>您的个人信息将仅用于以下用途：<br><ul><li>验证您是否符合特定问卷部分的参与资格</li><li>用于不同人群的统计与人口特征分析</li><li>生成您的个性化 CHON 性格分析报告</li></ul>";
    
    return (
      <div className={`privacy-statement ${privacyClass}`} lang={language} style={{ overflowX: 'hidden', maxWidth: '100%' }}>
        <div 
          className="privacy-text" 
          lang={language} 
          dangerouslySetInnerHTML={{ __html: typingText }}
        />
        <button 
          className="privacy-continue"
          onClick={handlePrivacyContinue}
          lang={language}
          disabled={isTyping}
          style={{ opacity: isTyping ? 0.5 : 1, cursor: isTyping ? 'not-allowed' : 'pointer' }}
        >
          <span>{language === 'en' ? 'CONTINUE' : '继续'}</span>
          <span className="continue-arrow">→</span>
        </button>
      </div>
    );
  };

  // Render content based on step
  const renderContent = () => {
    switch (step) {
      case 'intro':
        return renderIntroContent();
      case 'identity':
        return renderIdentitySelection();
      case 'privacy':
        return renderPrivacyStatement();
      case 'questionnaire':
        return renderQuestionnaireContent();
      default:
        return null;
    }
  };

  return (
    <main className={containerClass} lang={language}>
      <MetaTags />
      
      {showSaveIndicator && (
        <div className="save-indicator">
          {language === 'en' ? 'Progress saved' : '进度已保存'}
        </div>
      )}
      
      {/* 只为非母亲问卷页面显示背景 */}
      {step !== 'privacy' && step !== 'questionnaire' && (
        <>
          <div className="molecule-background"></div>
          <div className="hexagon-pattern"></div>
        </>
      )}
      
      {/* Show exit button at the top left corner for questionnaire and privacy screens */}
      {(step === 'privacy' || step === 'questionnaire') && exitButton}
      
      {renderContent()}
      
      {/* Only show LanguageSelector when not in questionnaire or privacy screens */}
      {step !== 'privacy' && step !== 'questionnaire' && <LanguageSelector />}
    </main>
  );
};

export default PersonalityTest; 