import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import LanguageSelector from '../../components/LanguageSelector/LanguageSelector.tsx';
import './PersonalityTest.css';
import BothQuestionnaire from './BothQuestionnaire.tsx';
import SearchableDropdown from './SearchableDropdown.tsx';
import EmailVerificationQuestion from './EmailVerificationQuestion.tsx';
import { scrollToNextQuestion, scrollToFirstQuestionOfNextPage, showAllQuestionsOnScroll, resetUserScroll } from './ScrollUtils.ts';
import questionnaireApi, { prepareQuestionResponses, QuestionResponse } from '../../api/questionnaire.ts';
import { getApiBaseUrl } from '../../config/apiBaseUrl.ts';
import {
  clearIntroClientStateForBeginTest,
  canAccessPersonalityVerifyOrQuestionnaire,
  hasPersonalityUserSession,
  migrateLegacyIntroIfNeeded,
  readIntroPersisted,
  readIntroStatsSnapshot,
  writeIntroPersisted,
  writeIntroStatsSnapshot
} from '../../utils/introStorage.ts';
import { parseChonSessionIdFromSearch, CHON_USER_SESSION_UUID_RE } from '../../utils/chonSessionUrl.ts';
import userSessionApi, { fetchSavedQuestionnaireAnswers } from '../../api/userSession.ts';
import { questionnaires, questionnaireConfigs, Question, QuestionType, QuestionnaireType, QuestionnaireContext, getQuestionsForSection, getSectionInfo } from './questionnaires.ts';
import {
  scaleValueToPercentage, 
  toChineseTag,
  toEnglishTag,
  calculateTagStats, 
  CHINESE_TAGS,
  buildTagScoreArraysFromLocalStorage,
  rebuildQuestionScoreMapsFromMergedAnswers,
  type QuestionForTagReconstruction,
  resolveEffectiveTagEnglishList
} from '../../utils/tagUtils';
import {
  buildCharacterMatchRowsFromSorted,
  buildFinalScoresForMatching,
  CHARACTER_MATCH_SORT_INPUT,
  sortCharactersForPersistence
} from '../../utils/characterMatchRows';
import './styles/searchable-dropdown.css';

type IdentityType = 'mother' | 'corporate' | 'both' | 'other';
type TestStep = 'intro' | 'identity' | 'privacy' | 'questionnaire';

interface PersonalityTestProps {
  onWhiteThemeChange?: (isWhite: boolean) => void;
  onHideUIChange?: (shouldHide: boolean) => void;
}

const identitiesForStoredQuestionnaireType = (qt: string): IdentityType[] => {
  switch (qt) {
    case 'mother':
      return ['mother'];
    case 'corporate':
      return ['corporate'];
    case 'other':
      return ['other'];
    case 'both':
      return ['mother', 'corporate'];
    default:
      return [];
  }
};

const questionnairePathWithOptionalSid = (sp: URLSearchParams): string => {
  const fromUrl = parseChonSessionIdFromSearch(sp);
  if (fromUrl) {
    return `/personality-test/questionnaire?sid=${encodeURIComponent(fromUrl)}`;
  }
  const ls = localStorage.getItem('userSessionId')?.trim() ?? '';
  if (ls && CHON_USER_SESSION_UUID_RE.test(ls)) {
    return `/personality-test/questionnaire?sid=${encodeURIComponent(ls)}`;
  }
  return '/personality-test/questionnaire';
};

const resolveUnifiedQuestionId = (questionId: string, questions: Question[]): number | null => {
  const match = questions.find((question) => question.id === questionId);
  if (match && typeof match.unifiedId === 'number' && !Number.isNaN(match.unifiedId)) {
    return match.unifiedId;
  }

  const suffix = /^[a-z]+_(\d+)$/i.exec(String(questionId));
  if (suffix) {
    const localIdx = parseInt(suffix[1], 10);
    const bySuffix = questions.find((q) => {
      const m = /^[a-z]+_(\d+)$/i.exec(q.id);
      return m && parseInt(m[1], 10) === localIdx;
    });
    if (bySuffix && typeof bySuffix.unifiedId === 'number' && !Number.isNaN(bySuffix.unifiedId)) {
      return bySuffix.unifiedId;
    }
  }

  const numeric = parseInt(questionId, 10);
  return Number.isNaN(numeric) ? null : numeric;
};

const MetaTags = () => {
  React.useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
    
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
  const navigate = useNavigate(); 
  const { step: stepSlug } = useParams<{ step?: string }>();
  const [step, setStep] = useState<TestStep>('intro');
  
  useEffect(() => {
    console.log('Current step:', step);
  }, [step]);
  const [userChoice, setUserChoice] = useState<string | null>(null);
  const [selectedIdentities, setSelectedIdentities] = useState<Set<IdentityType>>(new Set());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [typingText, setTypingText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
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
  // Displayed counts are global (GET /intro-stats). Only hydrate from snapshot here;
  // persisted tallies are per-browser click counts — not the same as intro_choices totals.
  const [introStats, setIntroStats] = useState(() => {
    migrateLegacyIntroIfNeeded();
    const snap = readIntroStatsSnapshot();
    if (snap) {
      return {
        yesCount: snap.yesCount,
        noCount: snap.noCount,
        yesPercentage: snap.yesPercentage,
        loading: false,
      };
    }
    return {
      yesCount: 0,
      noCount: 0,
      yesPercentage: 50,
      loading: true,
    };
  });
  
  const [localChoices, setLocalChoices] = useState<{yes: number, no: number}>(() => {
    migrateLegacyIntroIfNeeded();
    return readIntroPersisted().tallies;
  });
  
  const [hasUserChosen, setHasUserChosen] = useState<boolean>(() => {
    migrateLegacyIntroIfNeeded();
    return readIntroPersisted().hasChosen;
  });
  const [activeQuestionnaire, setActiveQuestionnaire] = useState<QuestionnaireType | null>(() => {
    try {
      const savedQuestionnaire = localStorage.getItem('selectedQuestionnaireType');
      if (savedQuestionnaire && ['mother', 'corporate', 'both', 'other'].includes(savedQuestionnaire)) {
        return savedQuestionnaire as QuestionnaireType;
      }
    } catch (error) {
      console.warn('Failed to read selectedQuestionnaireType from localStorage:', error);
    }
    return null;
  });
  
  const [userSessionId, setUserSessionId] = useState<string | null>(null);
  const sessionCreateInFlight = useRef(false);
  const verifyEmailLinkHandledRef = useRef(false);
  const questionnaireServerHydrateRef = useRef(false);

  const getQuestionnaireTypeFromIdentities = useCallback((identities: Set<IdentityType>): QuestionnaireType | null => {
    if (identities.has('mother') && identities.has('corporate')) {
      return 'both';
    }
    if (identities.has('mother')) {
      return 'mother';
    }
    if (identities.has('corporate')) {
      return 'corporate';
    }
    if (identities.has('other')) {
      return 'other';
    }
    return null;
  }, []);

  useEffect(() => {
    const qt = getQuestionnaireTypeFromIdentities(selectedIdentities);
    const sid = userSessionId ?? localStorage.getItem('userSessionId');
    if (!qt || !sid || selectedIdentities.size === 0) {
      return;
    }
    localStorage.setItem('userSessionQuestionnaireType', qt);
    void userSessionApi.patchUserSession(sid, {
      questionnaire_type: qt,
      ...(qt === 'corporate' && selectedCorporateRole
        ? { corporate_role: selectedCorporateRole }
        : {}),
    });
  }, [
    selectedIdentities,
    userSessionId,
    selectedCorporateRole,
    getQuestionnaireTypeFromIdentities,
  ]);
  
  useEffect(() => {
    if (activeQuestionnaire) {
      localStorage.setItem('selectedQuestionnaireType', activeQuestionnaire);
      console.log('Saved questionnaire type to localStorage:', activeQuestionnaire);
    }
  }, [activeQuestionnaire]);
  
  useEffect(() => {
    const savedSessionId = localStorage.getItem('userSessionId');
    if (savedSessionId) {
      setUserSessionId(savedSessionId);
      console.log('Loaded user session ID from localStorage:', savedSessionId);
    }
  }, []);

  const [secondaryQuestionnaire, setSecondaryQuestionnaire] = useState<QuestionnaireType | null>(null);
  const [showingPrimaryQuestionnaire, setShowingPrimaryQuestionnaire] = useState(true);
  const [primaryAnswers, setPrimaryAnswers] = useState<Record<string, string>>({});
  const [secondaryAnswers, setSecondaryAnswers] = useState<Record<string, string>>({});
  const [tagScores, setTagScores] = useState<Record<string, number[]>>({});
  const textWithUnitAdvanceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (textWithUnitAdvanceTimerRef.current) {
        window.clearTimeout(textWithUnitAdvanceTimerRef.current);
      }
    };
  }, []);
  
  
  
  const clearStoredProgressForNewEmail = useCallback(() => {
    setAnswers({});
    setPrimaryAnswers({});
    setSecondaryAnswers({});
    setTagScores({});
    setShowFirstPage(true);
    setShowSecondPage(false);
    setShowThirdPage(false);
    setShowFourthPage(false);
    setShowFifthPage(false);
    setShowSixthPage(false);

    localStorage.removeItem('chon_personality_answers');
    localStorage.removeItem('chon_personality_both_primary_answers');
    localStorage.removeItem('chon_personality_both_secondary_answers');
    localStorage.removeItem('tagScores');
    localStorage.removeItem('tagStats');
    localStorage.removeItem('chon_personality_flow_step');

    CHINESE_TAGS.forEach((tag) => {
      const englishTag = toEnglishTag(tag);
      localStorage.removeItem(`questionScores_${englishTag}`);
    });
  }, []);

  const getCurrentQuestionnaire = useCallback((): QuestionnaireContext | null => {
    if (selectedIdentities.has('mother') && selectedIdentities.has('corporate')) {
      if (showingPrimaryQuestionnaire) {
        return activeQuestionnaire ? questionnaires[activeQuestionnaire] : null;
      } else {
        return secondaryQuestionnaire ? questionnaires[secondaryQuestionnaire] : null;
      }
    }
    
    return activeQuestionnaire ? questionnaires[activeQuestionnaire] : null;
  }, [activeQuestionnaire, secondaryQuestionnaire, selectedIdentities, showingPrimaryQuestionnaire]);

  const getCurrentQuestions = useCallback((): Question[] => {
    return getCurrentQuestionnaire()?.questions || [];
  }, [getCurrentQuestionnaire]);
  
  const getTotalQuestions = useCallback((): number => {
    return getCurrentQuestionnaire()?.totalQuestions || 0;
  }, [getCurrentQuestionnaire]);
  
  const showOnlyQuestion = (questionId: string) => {
    resetUserScroll();
    
    const allQuestions = document.querySelectorAll('.question-container');
    const continueButton = document.querySelector('.question-navigation');
    
    allQuestions.forEach((q) => {
      q.classList.add('question-hidden');
      q.classList.remove('question-visible');
    });
    
    if (continueButton) {
      continueButton.classList.add('button-hidden');
      continueButton.classList.remove('button-visible');
    }
    
    setTimeout(() => {
      const targetQuestion = document.getElementById(`question-${questionId}`);
      if (targetQuestion) {
        targetQuestion.classList.add('question-visible');
        targetQuestion.classList.remove('question-hidden');
        
        if (questionId.includes('5') || questionId.includes('8')) {
          void targetQuestion.offsetHeight;
          
          const questionHeight = targetQuestion.getBoundingClientRect().height;
          const viewportHeight = window.innerHeight;
          const hasManyOptions = targetQuestion.querySelectorAll('.answer-option').length > 8;
          
          if (hasManyOptions || questionHeight > viewportHeight * 0.7) {
            // Position at top to show all answer options
            setTimeout(() => {
              targetQuestion.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start'
              });
            }, 100);
          }
        }
      }
    }, 50);
  };
  
  // Function to show continue button and scroll to it
  const showContinueButton = () => {
    setTimeout(() => {
      // Hide all questions except the last one
      const allQuestions = document.querySelectorAll('.question-container');
      const questionArray = Array.from(allQuestions);
      
      questionArray.forEach((q, index) => {
        if (index === questionArray.length - 1) {
          // Keep last question visible
          q.classList.add('question-visible');
          q.classList.remove('question-hidden');
        } else {
          // Hide all other questions (including second-to-last)
          q.classList.add('question-hidden');
          q.classList.remove('question-visible');
        }
      });
      
      // Show continue button
      const continueButton = document.querySelector('.question-navigation');
      if (continueButton) {
        continueButton.classList.remove('button-hidden');
        continueButton.classList.add('button-visible');
        
        // Scroll to show continue button
        setTimeout(() => {
          continueButton.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'end'
          });
        }, 100);
      }
    }, 10);
  };
  
  // Check if current question is the last in current section
  const isLastQuestionInSection = (questionId: string): boolean => {
    const allQuestions = document.querySelectorAll('.question-container');
    const questionArray = Array.from(allQuestions);
    const currentIndex = questionArray.findIndex(q => q.id === `question-${questionId}`);
    
    // Check if this is the last question on the current page
    return currentIndex === questionArray.length - 1;
  };

  // Initialize scroll listener and first question visibility
  useEffect(() => {
    showAllQuestionsOnScroll();
  }, []);
  
  // Initialize first question visibility when page changes
  useEffect(() => {
    // Reset scroll tracking when changing pages
    resetUserScroll();
    
    // Multiple passes to ensure all questions are caught
    const hideAllAndShowFirst = (attempt: number = 0) => {
      const allQuestions = document.querySelectorAll('.question-container');
      const continueButton = document.querySelector('.question-navigation');
      
      // Hide all questions
      allQuestions.forEach(q => {
        q.classList.add('question-hidden');
        q.classList.remove('question-visible');
      });
      
      // Hide continue button
      if (continueButton) {
        continueButton.classList.add('button-hidden');
        continueButton.classList.remove('button-visible');
      }
      
      // Show only first question
      const firstQuestion = allQuestions[0];
      if (firstQuestion) {
        firstQuestion.classList.add('question-visible');
        firstQuestion.classList.remove('question-hidden');
      }
      
      // Run multiple times to catch late-rendered questions
      if (attempt < 3) {
        setTimeout(() => hideAllAndShowFirst(attempt + 1), 150);
      }
    };
    
    // Start the process
    setTimeout(() => hideAllAndShowFirst(0), 100);
  }, [showFirstPage, showSecondPage, showThirdPage, showFourthPage, showFifthPage, showSixthPage, step]);
  
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
    
    const savedBothPrimary = localStorage.getItem('chon_personality_both_primary_answers');
    const savedBothSecondary = localStorage.getItem('chon_personality_both_secondary_answers');
    const savedQt = localStorage.getItem('selectedQuestionnaireType');
    if (savedQt === 'both') {
      if (savedBothPrimary) {
        try {
          setPrimaryAnswers(JSON.parse(savedBothPrimary) as Record<string, string>);
        } catch {
          /* ignore */
        }
      }
      if (savedBothSecondary) {
        try {
          setSecondaryAnswers(JSON.parse(savedBothSecondary) as Record<string, string>);
        } catch {
          /* ignore */
        }
      }
      if (!savedBothPrimary && !savedBothSecondary && savedAnswers) {
        try {
          const merged = JSON.parse(savedAnswers) as Record<string, string>;
          setPrimaryAnswers(merged);
          setSecondaryAnswers(merged);
        } catch {
          /* ignore */
        }
      }
    } else if (savedAnswers) {
      setAnswers(JSON.parse(savedAnswers));
    }

    if (savedStep) {
      console.log('Saved step found in localStorage:', savedStep);
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
  
  const initializeQuestionnaireState = useCallback(() => {
    setShowFirstPage(true);
    setShowSecondPage(false);
    setShowThirdPage(false);
    setShowFourthPage(false);
    setShowFifthPage(false);
    setShowSixthPage(false);

    if (activeQuestionnaire === 'both') {
      setPrimaryAnswers({});
      setSecondaryAnswers({});
      setShowingPrimaryQuestionnaire(true);
    }

    setStep('questionnaire');
  }, [activeQuestionnaire]);

  const normalizeStepSlug = useCallback(() => {
    if (!stepSlug) return 'intro';
    const lower = stepSlug.toLowerCase();
    const valid = ['intro', 'identity', 'verify', 'questionnaire'];
    return valid.includes(lower) ? lower : 'intro';
  }, [stepSlug]);

  const goToStep = useCallback((slug: string, nextStep: TestStep) => {
    setStep(nextStep);
    navigate(`/personality-test/${slug}`);
  }, [navigate]);

  useEffect(() => {
    const normalized = (stepSlug || 'intro').toLowerCase();
    if (normalized !== 'intro') {
      return;
    }
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('verify')) {
      return;
    }
    if (localStorage.getItem('chon_questionnaire_completed') === 'true') {
      return;
    }
    const saved = localStorage.getItem('chon_personality_step');
    if (saved === 'questionnaire') {
      if (canAccessPersonalityVerifyOrQuestionnaire()) {
        navigate('/personality-test/questionnaire', { replace: true });
      } else {
        localStorage.removeItem('chon_personality_step');
      }
      return;
    }
    if (saved === 'privacy') {
      if (canAccessPersonalityVerifyOrQuestionnaire() || hasPersonalityUserSession()) {
        navigate('/personality-test/verify', { replace: true });
      } else {
        localStorage.removeItem('chon_personality_step');
      }
      return;
    }
    if (saved === 'email-verification') {
      if (canAccessPersonalityVerifyOrQuestionnaire() || hasPersonalityUserSession()) {
        navigate('/personality-test/questionnaire', { replace: true });
      } else {
        localStorage.removeItem('chon_personality_step');
      }
      return;
    }
    if (saved === 'identity') {
      if (hasPersonalityUserSession()) {
        navigate('/personality-test/identity', { replace: true });
      }
    }
  }, [stepSlug, navigate]);

  useEffect(() => {
    const normalized = (stepSlug || 'intro').toLowerCase();
    const sp = new URLSearchParams(window.location.search);
    const token = sp.get('verify');
    if (!token) {
      return;
    }
    if (verifyEmailLinkHandledRef.current) {
      return;
    }
    verifyEmailLinkHandledRef.current = true;
    const sid = sp.get('sid');
    const loginQs = new URLSearchParams({ verify: token });
    if (sid) {
      loginQs.set('sid', sid);
    }
    loginQs.set('mode', 'register');
    navigate(`/login?${loginQs.toString()}`, { replace: true });
  }, [stepSlug, navigate]);

  useEffect(() => {
    const normalized = normalizeStepSlug();
    if (normalized !== (stepSlug || 'intro')) {
      navigate(`/personality-test/${normalized}`, { replace: true });
      return;
    }

    const search = new URLSearchParams(window.location.search);
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    // One-link flows must NOT bounce to intro before handlers run:
    // - Postmark: …/questionnaire?verify=token
    // - Supabase PKCE: …/questionnaire?code=… (or hash tokens) before replaceState
    // - After AuthCallback/sync or verifyEmailToken: emailVerified in localStorage
    const questionnaireDeepLink =
      normalized === 'questionnaire' &&
      (Boolean(search.get('verify')) ||
        Boolean(search.get('code')) ||
        Boolean(search.get('token_hash')) ||
        search.get('type') === 'magiclink' ||
        hash.includes('access_token'));
    const emailVerifiedBypass =
      normalized === 'questionnaire' && localStorage.getItem('emailVerified') === 'true';
    // Mid-flow on /verify (privacy or email step): do not bounce to intro if identity JSON was cleared.
    const verifyRouteBypass =
      normalized === 'verify' &&
      hasPersonalityUserSession() &&
      localStorage.getItem('chon_personality_step') === 'privacy';
    const inMemoryVerifyOrQuestionnaireAccess =
      hasPersonalityUserSession() && selectedIdentities.size > 0;
    const bypassIntroGate =
      questionnaireDeepLink || emailVerifiedBypass || verifyRouteBypass;

    if (normalized === 'identity' && !hasPersonalityUserSession()) {
      localStorage.removeItem('chon_personality_step');
      navigate('/personality-test/intro', { replace: true });
      return;
    }
    if (
      (normalized === 'verify' || normalized === 'questionnaire') &&
      !bypassIntroGate &&
      !canAccessPersonalityVerifyOrQuestionnaire() &&
      !inMemoryVerifyOrQuestionnaireAccess
    ) {
      localStorage.removeItem('chon_personality_step');
      navigate('/personality-test/intro', { replace: true });
      return;
    }

    if (normalized === 'intro') {
      setStep('intro');
    } else if (normalized === 'identity') {
      setStep('identity');
    } else if (normalized === 'verify') {
      setStep('privacy');
    } else if (normalized === 'questionnaire') {
      setStep('questionnaire');
    }
  }, [normalizeStepSlug, selectedIdentities, stepSlug]);

  // Supabase may redirect to Site URL or a path without `/verify`; move auth handoff onto verify.
  useEffect(() => {
    const n = (stepSlug || 'intro').toLowerCase();
    if (n === 'verify') {
      return;
    }
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const hasHandoff =
      Boolean(url.searchParams.get('code')) ||
      url.searchParams.get('type') === 'magiclink' ||
      Boolean(url.searchParams.get('token_hash')) ||
      window.location.hash.includes('access_token') ||
      Boolean(url.searchParams.get('error')) ||
      Boolean(url.searchParams.get('error_description')) ||
      Boolean(hashParams.get('error')) ||
      Boolean(hashParams.get('error_description'));
    if (!hasHandoff) {
      return;
    }
    navigate(
      `/auth/callback${url.search}${window.location.hash}`,
      { replace: true }
    );
  }, [stepSlug, navigate]);

  useEffect(() => {
    if (step === 'questionnaire') {
      const completed = localStorage.getItem('chon_questionnaire_completed') === 'true';
      if (completed) {
        navigate('/personality-test/results', { replace: true });
      }
    }
  }, [step, navigate]);

  useEffect(() => {
    const resumeFromEmailVerification = async () => {
      const url = new URL(window.location.href);
      if (url.searchParams.get('verify')) {
        return;
      }
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const hasAuthParams =
        !!url.searchParams.get('code') ||
        !!url.searchParams.get('token_hash') ||
        url.searchParams.get('type') === 'magiclink' ||
        window.location.hash.includes('access_token') ||
        !!url.searchParams.get('error') ||
        !!url.searchParams.get('error_description') ||
        !!hashParams.get('error') ||
        !!hashParams.get('error_description');

      if (hasAuthParams) {
        navigate(`/auth/callback${url.search}${window.location.hash}`, { replace: true });
      }
    };

    void resumeFromEmailVerification();
  }, [navigate]);

  useEffect(() => {
    if (step !== 'questionnaire' || questionnaireServerHydrateRef.current) {
      return;
    }
    const sid = localStorage.getItem('userSessionId');
    if (!sid) {
      return;
    }
    let ansCount = 0;
    try {
      const raw = localStorage.getItem('chon_personality_answers');
      if (raw) {
        ansCount = Object.keys(JSON.parse(raw) as Record<string, string>).length;
      }
    } catch {
      ansCount = 0;
    }
    if (ansCount > 0) {
      return;
    }
    questionnaireServerHydrateRef.current = true;
    void (async () => {
      const hydrated = await fetchSavedQuestionnaireAnswers(sid);
      if (!hydrated || Object.keys(hydrated.answers).length === 0) {
        return;
      }
      const qt = hydrated.questionnaireType;
      if (qt === 'both') {
        setPrimaryAnswers(hydrated.answers);
        setSecondaryAnswers(hydrated.answers);
        localStorage.setItem('chon_personality_both_primary_answers', JSON.stringify(hydrated.answers));
        localStorage.setItem('chon_personality_both_secondary_answers', JSON.stringify(hydrated.answers));
      } else {
        setAnswers(hydrated.answers);
      }
      localStorage.setItem('chon_personality_answers', JSON.stringify(hydrated.answers));
      if (qt && ['mother', 'corporate', 'other', 'both'].includes(qt)) {
        localStorage.setItem('selectedQuestionnaireType', qt);
        setActiveQuestionnaire(qt as QuestionnaireType);
      }
    })();
  }, [step]);
  
  // 保存答案到本地存储（both 问卷分别存 primary / secondary，避免丢题）
  useEffect(() => {
    if (activeQuestionnaire === 'both') {
      localStorage.setItem('chon_personality_both_primary_answers', JSON.stringify(primaryAnswers));
      localStorage.setItem('chon_personality_both_secondary_answers', JSON.stringify(secondaryAnswers));
      localStorage.setItem(
        'chon_personality_answers',
        JSON.stringify({ ...primaryAnswers, ...secondaryAnswers })
      );
    } else {
      localStorage.setItem('chon_personality_answers', JSON.stringify(answers));
    }
    const count =
      activeQuestionnaire === 'both'
        ? Object.keys({ ...primaryAnswers, ...secondaryAnswers }).length
        : Object.keys(answers).length;
    if (count > 0) {
      setShowSaveIndicator(true);
      const timer = setTimeout(() => {
        setShowSaveIndicator(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [activeQuestionnaire, answers, primaryAnswers, secondaryAnswers]);
  
  // 保存当前步骤到本地存储
  useEffect(() => {
    localStorage.setItem('chon_personality_step', step);
  }, [step]);

  const flowStep = useMemo(() => {
    switch (step) {
      case 'intro':
        return 1;
      case 'identity':
        return 2;
      case 'privacy':
        return 3;
      case 'questionnaire':
        return 4;
      default:
        return 1;
    }
  }, [step]);

  useEffect(() => {
    localStorage.setItem('chon_personality_flow_step', flowStep.toString());
  }, [flowStep]);
  
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

  // Privacy statement content (no animation)
  useEffect(() => {
    if (step === 'privacy') {
      const currentQuestionnaire = getCurrentQuestionnaire();
      if (!currentQuestionnaire) return;

      const privacyTextEn = "<strong style=\"font-size: 1.2em;\">Data Usage and Privacy Statement</strong><br><br>At CHON, your privacy is fundamental. We only collect the information necessary to deliver meaningful insights, and we protect it with the highest standards of security and integrity.<br><br><hr><br><br><strong style=\"font-size: 1.2em;\">For Individual Participants</strong><br><br>Your personal information will be used solely for the following purposes:<br><ul><li>To verify your eligibility for specific sections of the survey</li><li>To support demographic and statistical analysis across participant groups</li><li>To generate your personalized CHON personality profile</li></ul>";
      
      const privacyTextZh = "<strong style=\"font-size: 1.2em;\">数据使用与隐私声明</strong><br><br>在 CHON，我们将您的隐私视为基本原则。我们仅收集实现分析目的所必需的信息，并以最高标准保障数据的安全与完整性。<br><br><hr><br><br><strong style=\"font-size: 1.2em;\">针对个人参与者</strong><br><br>您的个人信息将仅用于以下用途：<br><ul><li>验证您是否符合特定问卷部分的参与资格</li><li>用于不同人群的统计与人口特征分析</li><li>生成您的个性化 CHON 性格分析报告</li></ul>";

      const fullText = language === 'en' 
        ? currentQuestionnaire.privacyStatement?.contentEn || privacyTextEn
        : currentQuestionnaire.privacyStatement?.contentZh || privacyTextZh;

      setTypingText(fullText);
      setIsTyping(false);
    }
  }, [getCurrentQuestionnaire, language, step]);

  // 根据步骤决定是否隐藏UI元素 - Make sure this runs immediately
  useEffect(() => {
    if (onHideUIChange) {
      // Only hide UI for specific steps, otherwise show it
      const shouldHideUI = step === 'privacy' || step === 'questionnaire';
      onHideUIChange(shouldHideUI);
      
      console.log('Step:', step, 'shouldHideUI:', shouldHideUI);
    }
  }, [step, onHideUIChange]);
  
  // Also send the initial state immediately on mount
  useEffect(() => {
    // On initial mount, ensure UI is visible unless we're in a state that should hide it
    // This will be properly set by the other useEffect
    console.log('PersonalityTest mounted, step:', step);
    // This runs only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset corporate roles state when returning to identity step
  useEffect(() => {
    if (step === 'identity') {
      setShowCorporateRoles(false);
      setSelectedCorporateRole(null);
    }
  }, [step]);

  useEffect(() => {
    if (
      (step === 'privacy' || step === 'questionnaire') &&
      (selectedIdentities.size === 0 || !activeQuestionnaire)
    ) {
      goToStep('intro', 'intro');
    }
  }, [activeQuestionnaire, goToStep, selectedIdentities.size, step]);

  useEffect(() => {
    if (activeQuestionnaire || selectedIdentities.size === 0) {
      return;
    }

    if (selectedIdentities.has('mother') && selectedIdentities.has('corporate')) {
      setActiveQuestionnaire('both');
    } else if (selectedIdentities.has('mother')) {
      setActiveQuestionnaire('mother');
    } else if (selectedIdentities.has('corporate')) {
      setActiveQuestionnaire('corporate');
    } else if (selectedIdentities.has('other')) {
      setActiveQuestionnaire('other');
    }
  }, [activeQuestionnaire, selectedIdentities]);

  // 添加获取intro统计数据的函数
  const fetchIntroStats = useCallback(async () => {
    const base = getApiBaseUrl();
    try {
      console.log("Fetching intro stats from:", `${base}/intro-stats`);
      const response = await fetch(`${base}/intro-stats`);
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Raw API response:", data);
      
      // Handle different possible response formats
      const yesCount = Number(data.yes_count ?? data.yesCount ?? data.yes ?? 0) || 0;
      const noCount = Number(data.no_count ?? data.noCount ?? data.no ?? 0) || 0;
      const totalResponses = yesCount + noCount;
      const yesPercentage =
        typeof data.yes_percentage === 'number' && !Number.isNaN(data.yes_percentage)
          ? data.yes_percentage
          : totalResponses > 0
            ? Math.round((yesCount / totalResponses) * 100)
            : 50;
      
      console.log("Processed stats:", { yesCount, noCount, totalResponses, yesPercentage });

      // Always use API data for real-time stats (canonical historical counts in DB)
      console.log("Using API data for intro stats:", { yesCount, noCount, yesPercentage });
      setIntroStats({
        yesCount,
        noCount,
        yesPercentage,
        loading: false
      });
      writeIntroStatsSnapshot({ yesCount, noCount, yesPercentage });
      
    } catch (error) {
      console.error("Error fetching intro stats:", error);
      const snap = readIntroStatsSnapshot();
      if (snap) {
        setIntroStats({
          yesCount: snap.yesCount,
          noCount: snap.noCount,
          yesPercentage: snap.yesPercentage,
          loading: false
        });
        return;
      }
      setIntroStats(prev => ({
        ...prev,
        loading: false
      }));
    }
  }, []);

  useEffect(() => {
    if (step === 'intro') {
      try {
        const persisted = readIntroPersisted();
        setLocalChoices(persisted.tallies);
        setHasUserChosen(persisted.hasChosen);
        setUserChoice(persisted.lastChoice);
        if (persisted.hasChosen) {
          console.log('Restored intro state from persistent storage (v1 + legacy migration).');
        }
      } catch (error) {
        console.error('Error loading intro persistence:', error);
      }
      
      // 同时预加载统计数据，但不会影响UI显示
      fetchIntroStats();
      
      // 设置定期刷新统计数据以显示实时更新
      const interval = setInterval(() => {
        fetchIntroStats();
      }, 5000); // 每5秒刷新一次
      
      return () => clearInterval(interval);
    }
  }, [fetchIntroStats, step]);

  const handleOptionClick = async (choice: string) => {
    console.log("User clicked:", choice);
    setUserChoice(choice);
    
    // Mark that user has made a choice and persist (versioned + legacy mirror keys)
    setHasUserChosen(true);
    setLocalChoices(prev => {
      const newChoices = {
        ...prev,
        [choice]: prev[choice as keyof typeof prev] + 1
      };
      writeIntroPersisted({
        hasChosen: true,
        tallies: newChoices,
        lastChoice: choice
      });
      return newChoices;
    });
    
    try {
      // Resume from email link: same CHON session id is in the URL — do not create a second session.
      try {
        const sidFromUrl = parseChonSessionIdFromSearch(new URLSearchParams(window.location.search));
        if (sidFromUrl) {
          localStorage.setItem('userSessionId', sidFromUrl);
          setUserSessionId(sidFromUrl);
          await fetchIntroStats();
          return;
        }
      } catch {
        /* ignore */
      }
      const lsSid = (localStorage.getItem('userSessionId') || '').trim();
      if (!userSessionId && lsSid) {
        setUserSessionId(lsSid);
      }

      // 实时保存intro choice到后端
      const success = await questionnaireApi.saveIntroChoice(choice);
      console.log("Save intro choice result:", success);

      const effectiveSessionId = (userSessionId || lsSid || '').trim() || null;
      if (!effectiveSessionId) {
        if (sessionCreateInFlight.current) {
          await fetchIntroStats();
          return;
        }
        sessionCreateInFlight.current = true;
        const session = await userSessionApi.createUserSession(choice);
        setUserSessionId(session.user_session_id);
        localStorage.setItem('userSessionId', session.user_session_id);
        sessionCreateInFlight.current = false;
      }

      await fetchIntroStats();
      
    } catch (error) {
      console.error("Error saving intro choice:", error);
      sessionCreateInFlight.current = false;
    }
  };
  
  const handleBeginTest = () => {
    // Reset intro UI state for this browser when starting the test (server intro_choices history unchanged)
    clearIntroClientStateForBeginTest();
    setLocalChoices({ yes: 0, no: 0 });
    setHasUserChosen(false);
    setUserChoice(null);
    goToStep('identity', 'identity');
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

    const nextQuestionnaire = getQuestionnaireTypeFromIdentities(newSelectedIdentities);
    setActiveQuestionnaire(nextQuestionnaire);

    const storedSessionType = localStorage.getItem('userSessionQuestionnaireType');
    if (storedSessionType && nextQuestionnaire && storedSessionType !== nextQuestionnaire) {
      clearStoredProgressForNewEmail();
      setUserSessionId(null);
      localStorage.removeItem('userSessionId');
      localStorage.removeItem('userSessionEmail');
      localStorage.removeItem('userSessionQuestionnaireType');
    }

    // 更新状态
    setSelectedIdentities(newSelectedIdentities);
  };

  const handleContinue = async () => {
    if (selectedIdentities.size === 0) {
      return;
    }

    const questionnaireType = getQuestionnaireTypeFromIdentities(selectedIdentities);
    if (questionnaireType) {
      setActiveQuestionnaire(questionnaireType);
      setSecondaryQuestionnaire(null);
    }

    if (questionnaireType) {
      localStorage.setItem('userSessionQuestionnaireType', questionnaireType);
    }

    // Proceed to privacy statement
    goToStep('verify', 'privacy');
  };

  const handlePrivacyContinue = () => {
    localStorage.setItem('chon_personality_step', 'questionnaire');
    initializeQuestionnaireState();
    navigate('/personality-test/questionnaire');
  };

  const isIdentitySelected = (identity: IdentityType): boolean => {
    return selectedIdentities.has(identity);
  };

  // Handle answer selection for multiple choice questions
  const handleMultipleChoiceAnswer = (questionId: string, optionId: string) => {
    const normalizedQuestionId = String(questionId);
    const currentAnswers = getCurrentAnswers();
    if (localStorage.getItem('chon_questionnaire_completed') === 'true') {
      return;
    }
    const unifiedQuestionId = resolveUnifiedQuestionId(normalizedQuestionId, getCurrentQuestions());
    const nextAnswers = { ...currentAnswers, [normalizedQuestionId]: optionId };
    setCurrentAnswers(nextAnswers);

    // Update tag scores
    updateTagScores(normalizedQuestionId, optionId);

    // Auto-finish if this is question 25 (final question)
    if (unifiedQuestionId === 25) {
      // Pass nextAnswers into finishQuestionnaire so the batch save includes Q25 (avoids stale closure).
      setTimeout(() => {
        const both =
          (selectedIdentities.has('mother') && selectedIdentities.has('corporate')) ||
          activeQuestionnaire === 'both';
        if (both) {
          if (showingPrimaryQuestionnaire) {
            void finishQuestionnaire({ primaryAnswers: nextAnswers });
          } else {
            void finishQuestionnaire({ secondaryAnswers: nextAnswers });
          }
        } else {
          void finishQuestionnaire({ answers: nextAnswers });
        }
      }, 500);
      return;
    }
    
    // Check if this is the last question in the section
    if (isLastQuestionInSection(normalizedQuestionId)) {
      // Show continue button (keep last question visible)
      setTimeout(() => {
        showContinueButton();
      }, 300);
    } else {
      // Find and show next question
      const currentNum = parseInt(normalizedQuestionId.split('_')[1]) || 0;
      const prefix = normalizedQuestionId.split('_')[0];
      const nextQuestionId = `${prefix}_${currentNum + 1}`;
      
      // Show next question and scroll to it
      setTimeout(() => {
        showOnlyQuestion(nextQuestionId);
        scrollToNextQuestion(normalizedQuestionId);
      }, 100);
    }
  };

  // Handle text input for free text questions
  const handleTextAnswer = (questionId: string, text: string) => {
    const normalizedQuestionId = String(questionId);
    const currentAnswers = getCurrentAnswers();
    if (localStorage.getItem('chon_questionnaire_completed') === 'true') {
      return;
    }
    // Only update answer when there's text content
    if (text.trim()) {
      setCurrentAnswers({
        ...currentAnswers,
        [normalizedQuestionId]: text
      });
      // Text answers are saved in batch on completion.
    } else {
      // Remove the answer if text is empty to accurately track progress
      const newAnswers = {...currentAnswers};
      delete newAnswers[normalizedQuestionId];
      setCurrentAnswers(newAnswers);
    }
  };

  const advanceFromQuestion = (questionId: string) => {
    const normalizedQuestionId = String(questionId);

    if (isLastQuestionInSection(normalizedQuestionId)) {
      setTimeout(() => {
        showContinueButton();
      }, 300);
      return;
    }

    const currentNum = parseInt(normalizedQuestionId.split('_')[1]) || 0;
    const prefix = normalizedQuestionId.split('_')[0];
    const nextQuestionId = `${prefix}_${currentNum + 1}`;

    setTimeout(() => {
      showOnlyQuestion(nextQuestionId);
      scrollToNextQuestion(normalizedQuestionId);
    }, 100);
  };

  const handleTextWithUnitAnswer = (questionId: string, text: string) => {
    handleTextAnswer(questionId, text);

    if (textWithUnitAdvanceTimerRef.current) {
      window.clearTimeout(textWithUnitAdvanceTimerRef.current);
      textWithUnitAdvanceTimerRef.current = null;
    }

    const [value] = text.split('_');
    if (!value.trim()) {
      return;
    }

    textWithUnitAdvanceTimerRef.current = window.setTimeout(() => {
      advanceFromQuestion(questionId);
      textWithUnitAdvanceTimerRef.current = null;
    }, 650);
  };

  // Handle Enter key press for text inputs
  const handleTextInputKeyPress = (questionId: string, event: React.KeyboardEvent<HTMLInputElement>) => {
    const normalizedQuestionId = String(questionId);
    if (event.key === 'Enter' && getCurrentAnswers()[normalizedQuestionId]?.trim()) {
      advanceFromQuestion(normalizedQuestionId);
    }
  };

  // Handle scale question answer
  const handleScaleAnswer = (questionId: string, value: string) => {
    const normalizedQuestionId = String(questionId);
    const currentAnswers = getCurrentAnswers();
    if (localStorage.getItem('chon_questionnaire_completed') === 'true') {
      return;
    }
    setCurrentAnswers({
      ...currentAnswers,
      [normalizedQuestionId]: value
    });
    
    // Update tag scores
    updateTagScores(normalizedQuestionId, value);
    
    // Check if this is the last question in the section
    if (isLastQuestionInSection(normalizedQuestionId)) {
      // Show continue button (keep last question visible)
      setTimeout(() => {
        showContinueButton();
      }, 300);
    } else {
      // Find and show next question
      const currentNum = parseInt(normalizedQuestionId.split('_')[1]) || 0;
      const prefix = normalizedQuestionId.split('_')[0];
      const nextQuestionId = `${prefix}_${currentNum + 1}`;
      
      // Show next question and scroll to it
      setTimeout(() => {
        showOnlyQuestion(nextQuestionId);
        scrollToNextQuestion(normalizedQuestionId);
      }, 100);
    }
  };

  // Handle multi-select answer (stores comma-separated option ids)
  const handleMultiSelectAnswer = (questionId: string, values: string[]) => {
    const normalizedQuestionId = String(questionId);
    const currentAnswers = getCurrentAnswers();
    if (localStorage.getItem('chon_questionnaire_completed') === 'true') {
      return;
    }
    if (values.length > 0) {
      setCurrentAnswers({
        ...currentAnswers,
        [normalizedQuestionId]: values.join(',')
      });
    } else {
      const newAnswers = { ...currentAnswers };
      delete newAnswers[normalizedQuestionId];
      setCurrentAnswers(newAnswers);
    }
  };

  // Handle searchable dropdown answer
  const handleSearchableDropdownAnswer = (questionId: string, optionId: string) => {
    const normalizedQuestionId = String(questionId);
    const currentAnswers = getCurrentAnswers();
    if (localStorage.getItem('chon_questionnaire_completed') === 'true') {
      return;
    }
    setCurrentAnswers({
      ...currentAnswers,
      [normalizedQuestionId]: optionId
    });
    
    // Check if this is the last question in the section
    if (isLastQuestionInSection(normalizedQuestionId)) {
      // Show continue button (keep last question visible)
      setTimeout(() => {
        showContinueButton();
      }, 300);
    } else {
      // Find and show next question
      const currentNum = parseInt(normalizedQuestionId.split('_')[1]) || 0;
      const prefix = normalizedQuestionId.split('_')[0];
      const nextQuestionId = `${prefix}_${currentNum + 1}`;
      
      // Show next question and scroll to it
      setTimeout(() => {
        showOnlyQuestion(nextQuestionId);
        scrollToNextQuestion(normalizedQuestionId);
      }, 100);
    }
  };

  // Helper to get current answers based on which questionnaire is active
  const getCurrentAnswers = (): Record<string, string> => {
    // When both mother and corporate are selected or 'both' questionnaire is active
    if ((selectedIdentities.has('mother') && selectedIdentities.has('corporate')) || activeQuestionnaire === 'both') {
      return showingPrimaryQuestionnaire ? primaryAnswers : secondaryAnswers;
    }
    return answers;
  };

  // Helper to set current answers based on which questionnaire is active
  const setCurrentAnswers = (newAnswers: Record<string, string>) => {
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
        return renderBothQuestionnaire();
      default:
        return null;
    }
  };

  const renderMotherQuestionnaire = (questions: Question[]) => {
    const motherConfig = questionnaireConfigs.mother;
    
    // Helper function to get questions for a section index based on sections configuration
    const getQuestionsForSectionIndex = (sectionIndex: number) => {
      return getQuestionsForSection(questions, motherConfig, sectionIndex);
    };
    
    // Helper function to get section info for titles
    const getSectionTitle = (sectionIndex: number) => {
      const sectionInfo = getSectionInfo(motherConfig, sectionIndex);
      if (!sectionInfo) return '';
      if (sectionIndex === 0) {
        const answer = getCurrentAnswers()['mother_4'];
        if (answer === 'A') {
          return language === 'en' ? 'About Work-Life Balance' : '关于工作与生活平衡';
        }
        return language === 'en' ? 'About Life Balance' : '关于生活平衡';
      }
      return language === 'en' ? sectionInfo.title.en : sectionInfo.title.zh;
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
            // 第1页: Demographics & Background (Section 0)
            <div className="first-page-questions first-page-true">
              {getQuestionsForSectionIndex(0).map((question) => (
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
                          <p>{option.id} {language === 'en' ? option.textEn : option.textZh}</p>
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
                        onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}

                  {question.type === 'email' && (
                    <EmailVerificationQuestion
                      questionId={question.id}
                      value={getCurrentAnswers()[question.id] || ''}
                      onChange={(value) => handleTextAnswer(question.id, value)}
                      onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                    />
                  )}

                  {question.type === 'text-with-unit' && (
                    <div className="text-with-unit-container">
                      <input
                        type="text"
                        className="text-answer-input text-with-unit-input"
                        value={getCurrentAnswers()[question.id]?.split('_')[0] || ''}
                        onChange={(e) => {
                          const unit = getCurrentAnswers()[question.id]?.split('_')[1] || 'kg';
                          handleTextWithUnitAnswer(question.id, `${e.target.value}_${unit}`);
                        }}
                        onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                        placeholder={language === 'en' ? 'Enter weight' : '输入体重'}
                      />
                      <div className="unit-selector">
                        <SearchableDropdown
                          question={{
                            ...question,
                            id: `${question.id}_unit`
                          }}
                          selectedValue={getCurrentAnswers()[question.id]?.split('_')[1] || 'kg'}
                          onSelect={(unitId) => {
                            const value = getCurrentAnswers()[question.id]?.split('_')[0] || '';
                            handleTextWithUnitAnswer(question.id, `${value}_${unitId}`);
                          }}
                          language={language}
                        />
                      </div>
                    </div>
                  )}

                  {question.type === 'multi-select' && (
                    <div className="text-input-container">
                      <select
                        multiple
                        className="text-answer-input"
                        value={(getCurrentAnswers()[question.id]?.split(',') ?? [])}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                          handleMultiSelectAnswer(question.id, selected);
                        }}
                      >
                        {question.options?.map(option => (
                          <option key={option.id} value={option.id}>
                            {language === 'en' ? option.textEn : option.textZh}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {question.type === 'searchable-dropdown' && (
                    <div className="searchable-dropdown-container">
                      <SearchableDropdown
                        question={question}
                        selectedValue={getCurrentAnswers()[question.id] || ''}
                        onSelect={(optionId) => handleSearchableDropdownAnswer(question.id, optionId)}
                        language={language}
                      />
                    </div>
                  )}

                  {question.type === 'multi-select' && (
                    <div className="text-input-container">
                      <select
                        multiple
                        className="text-answer-input"
                        value={(getCurrentAnswers()[question.id]?.split(',') ?? [])}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                          handleMultiSelectAnswer(question.id, selected);
                        }}
                      >
                        {question.options?.map(option => (
                          <option key={option.id} value={option.id}>
                            {language === 'en' ? option.textEn : option.textZh}
                          </option>
                        ))}
                      </select>
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
                              ? question.scaleLabels?.left.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.left.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.right.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.right.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
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
                  disabled={Object.keys(getCurrentAnswers()).length < 8}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : showThirdPage ? (
            // 第2页: About Work-Life Balance (Section 1)
            <div className="first-page-questions">
              <h1 className="section-title">
                {getSectionTitle(1)}
              </h1>
              
              {getQuestionsForSectionIndex(1).map((question) => (
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
                          <p>{option.id} {language === 'en' ? option.textEn : option.textZh}</p>
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
                        onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}

                  {question.type === 'email' && (
                    <EmailVerificationQuestion
                      questionId={question.id}
                      value={getCurrentAnswers()[question.id] || ''}
                      onChange={(value) => handleTextAnswer(question.id, value)}
                      onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                    />
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
                              ? question.scaleLabels?.left.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.left.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.right.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.right.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
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
                  disabled={Object.keys(getCurrentAnswers()).length < 13}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : showFourthPage ? (
            // 第3页: About Us, CHON (Section 2)
            <div className="first-page-questions">
              <h1 className="section-title">
                {getSectionTitle(2)}
              </h1>
              
              {getQuestionsForSectionIndex(2).map((question) => (
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
                          <p>{option.id} {language === 'en' ? option.textEn : option.textZh}</p>
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
                        onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}

                  {question.type === 'email' && (
                    <EmailVerificationQuestion
                      questionId={question.id}
                      value={getCurrentAnswers()[question.id] || ''}
                      onChange={(value) => handleTextAnswer(question.id, value)}
                      onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                    />
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
                              ? question.scaleLabels?.left.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.left.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.right.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.right.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
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
                  disabled={Object.keys(getCurrentAnswers()).length < 14}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : showFifthPage ? (
            // 第4页: About Motherhood (Section 3)
            <div className="first-page-questions">
              <h1 className="section-title">
                {getSectionTitle(3)}
              </h1>
              
              {getQuestionsForSectionIndex(3).map((question) => (
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
                        onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}

                  {question.type === 'email' && (
                    <EmailVerificationQuestion
                      questionId={question.id}
                      value={getCurrentAnswers()[question.id] || ''}
                      onChange={(value) => handleTextAnswer(question.id, value)}
                      onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                    />
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
                              ? question.scaleLabels?.left.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.left.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.right.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.right.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
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
                  className="nav-button next-button"
                  onClick={() => {
                    setShowFifthPage(false);
                    setShowSixthPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                  disabled={Object.keys(getCurrentAnswers()).length < 13}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : null
        }

        {/* 母亲问卷第六页 - Final Question (Section 4) */}
        {
          showSixthPage ? (
            <div className="first-page-questions">
              {getQuestionsForSectionIndex(4).map((question) => (
                <div 
                  key={question.id}
                  id={`question-${question.id}`}
                  className={`question-container ${question.type === 'scale-question' ? 'scale-question-container' : ''} final-question`}
                >
                  {renderQuestionText(question)}
                  
                  {question.type === 'multiple-choice' && (
                    <div className="answer-options">
                      {question.options?.map((option) => (
                        <div 
                          key={option.id}
                          className={`answer-option ${getCurrentAnswers()[question.id] === option.id ? 'selected' : ''}`}
                          onClick={() => {
                            handleMultipleChoiceAnswer(question.id, option.id);
                          }}
                        >
                          <p>{option.id}) {language === 'en' ? option.textEn : option.textZh}</p>
                        </div>
                      ))}
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
                              onClick={() => {
                                handleScaleAnswer(question.id, value);
                              }}
                            >
                              <div className="scale-circle"></div>
                              <span className="scale-value">{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="scale-extreme-labels">
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.left.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.left.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.right.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.right.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null
        }
      </div>
    );
  };

  const renderCorporateQuestionnaire = (questions: Question[]) => {
    const corporateConfig = questionnaireConfigs.corporate;
    
    // Helper function to get questions for a section index
    const getQuestionsForSectionIndex = (sectionIndex: number) => {
      return getQuestionsForSection(questions, corporateConfig, sectionIndex);
    };
    
    // Helper function to get section info for titles
    const getSectionTitle = (sectionIndex: number) => {
      const sectionInfo = getSectionInfo(corporateConfig, sectionIndex);
      if (!sectionInfo) return '';
      return language === 'en' ? sectionInfo.title.en : sectionInfo.title.zh;
    };
    
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
            // 第1页: Demographics & Professional Background (Section 0)
            <div className="first-page-questions first-page-true">
              {getQuestionsForSectionIndex(0).map((question) => (
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
                        onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}

                  {question.type === 'email' && (
                    <EmailVerificationQuestion
                      questionId={question.id}
                      value={getCurrentAnswers()[question.id] || ''}
                      onChange={(value) => handleTextAnswer(question.id, value)}
                      onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                    />
                  )}

                  {question.type === 'text-with-unit' && (
                    <div className="text-with-unit-container">
                      <input
                        type="text"
                        className="text-answer-input text-with-unit-input"
                        value={getCurrentAnswers()[question.id]?.split('_')[0] || ''}
                        onChange={(e) => {
                          const unit = getCurrentAnswers()[question.id]?.split('_')[1] || 'kg';
                          handleTextWithUnitAnswer(question.id, `${e.target.value}_${unit}`);
                        }}
                        onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                        placeholder={language === 'en' ? 'Enter weight' : '输入体重'}
                      />
                      <div className="unit-selector">
                        <SearchableDropdown
                          question={{
                            ...question,
                            id: `${question.id}_unit`
                          }}
                          selectedValue={getCurrentAnswers()[question.id]?.split('_')[1] || 'kg'}
                          onSelect={(unitId) => {
                            const value = getCurrentAnswers()[question.id]?.split('_')[0] || '';
                            handleTextWithUnitAnswer(question.id, `${value}_${unitId}`);
                          }}
                          language={language}
                        />
                      </div>
                    </div>
                  )}
                  
                  {question.type === 'searchable-dropdown' && (
                    <div className="searchable-dropdown-container">
                      <SearchableDropdown
                        question={question}
                        selectedValue={getCurrentAnswers()[question.id] || ''}
                        onSelect={(optionId) => handleSearchableDropdownAnswer(question.id, optionId)}
                        language={language}
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
                              ? question.scaleLabels?.left.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.left.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.right.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.right.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
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
                  disabled={Object.keys(getCurrentAnswers()).length < 7}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : showSecondPage ? (
            // 第2页: About Your Leadership (questions 11-24)
            <div className="first-page-questions">
              <h1 className="section-title">
                {getSectionTitle(1)}
              </h1>
              
              {getQuestionsForSectionIndex(1).map((question) => (
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
                        onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}

                  {question.type === 'email' && (
                    <EmailVerificationQuestion
                      questionId={question.id}
                      value={getCurrentAnswers()[question.id] || ''}
                      onChange={(value) => handleTextAnswer(question.id, value)}
                      onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                    />
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
                              ? question.scaleLabels?.left.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.left.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.right.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.right.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
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
                  disabled={Object.keys(getCurrentAnswers()).length < 14}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : showThirdPage ? (
            // 第3页: About Us, CHON (Section 2)
            <div className="first-page-questions">
              <h1 className="section-title">
                {getSectionTitle(2)}
              </h1>
              
              {getQuestionsForSectionIndex(2).map((question) => (
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
                        onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}

                  {question.type === 'email' && (
                    <EmailVerificationQuestion
                      questionId={question.id}
                      value={getCurrentAnswers()[question.id] || ''}
                      onChange={(value) => handleTextAnswer(question.id, value)}
                      onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                    />
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
                              ? question.scaleLabels?.left.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.left.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.right.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.right.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
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
                  disabled={Object.keys(getCurrentAnswers()).length < 15}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : showFourthPage ? (
            // 第4页: About Motherhood (Section 3)
            <div className="first-page-questions">
              <h1 className="section-title">
                {getSectionTitle(3)}
              </h1>
              
              {getQuestionsForSectionIndex(3).map((question) => (
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
                        onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}

                  {question.type === 'email' && (
                    <EmailVerificationQuestion
                      questionId={question.id}
                      value={getCurrentAnswers()[question.id] || ''}
                      onChange={(value) => handleTextAnswer(question.id, value)}
                      onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                    />
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
                              ? question.scaleLabels?.left.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.left.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.right.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.right.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
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
                    setShowSixthPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                  disabled={Object.keys(getCurrentAnswers()).length < 11}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : null
        }

        {/* 企业问卷第六页 - Final Question (must use built question ids, e.g. corporate_33, not raw "25") */}
        {
          showSixthPage ? (
            <div className="questions-section">
              {getQuestionsForSectionIndex(4).map((question) => (
                <div 
                  key={question.id}
                  id={`question-${question.id}`}
                  className={`question-container ${question.type === 'scale-question' ? 'scale-question-container' : ''} question-visible final-question`}
                >
                  {renderQuestionText(question)}
                  {question.type === 'multiple-choice' && question.options && (
                    <div className="answer-options">
                      {question.options.map((option) => (
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
                </div>
              ))}
            </div>
          ) : null
        }
      </div>
    );
  };

  const renderOtherQuestionnaire = (questions: Question[]) => {
    const otherConfig = questionnaireConfigs.other;
    
    // Helper function to get questions for a section index
    const getQuestionsForSectionIndex = (sectionIndex: number) => {
      return getQuestionsForSection(questions, otherConfig, sectionIndex);
    };
    
    // Helper function to get section info for titles
    const getSectionTitle = (sectionIndex: number) => {
      const sectionInfo = getSectionInfo(otherConfig, sectionIndex);
      if (!sectionInfo) return '';
      if (sectionIndex === 1) {
        const answer = getCurrentAnswers()['other_3'];
        if (answer === 'A') {
          return language === 'en' ? 'About Professional Work' : '关于专业工作';
        }
        return language === 'en' ? 'About Teamwork' : '关于团队合作';
      }
      return language === 'en' ? sectionInfo.title.en : sectionInfo.title.zh;
    };
    
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
            // 第1页: Demographics & Background (Section 0)
            <div className="first-page-questions first-page-true">
              {getQuestionsForSectionIndex(0).map((question) => (
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
                        onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}

                  {question.type === 'email' && (
                    <EmailVerificationQuestion
                      questionId={question.id}
                      value={getCurrentAnswers()[question.id] || ''}
                      onChange={(value) => handleTextAnswer(question.id, value)}
                      onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                    />
                  )}

                  {question.type === 'text-with-unit' && (
                    <div className="text-with-unit-container">
                      <input
                        type="text"
                        className="text-answer-input text-with-unit-input"
                        value={getCurrentAnswers()[question.id]?.split('_')[0] || ''}
                        onChange={(e) => {
                          const unit = getCurrentAnswers()[question.id]?.split('_')[1] || 'kg';
                          handleTextWithUnitAnswer(question.id, `${e.target.value}_${unit}`);
                        }}
                        onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                        placeholder={language === 'en' ? 'Enter weight' : '输入体重'}
                      />
                      <div className="unit-selector">
                        <SearchableDropdown
                          question={{
                            ...question,
                            id: `${question.id}_unit`
                          }}
                          selectedValue={getCurrentAnswers()[question.id]?.split('_')[1] || 'kg'}
                          onSelect={(unitId) => {
                            const value = getCurrentAnswers()[question.id]?.split('_')[0] || '';
                            handleTextWithUnitAnswer(question.id, `${value}_${unitId}`);
                          }}
                          language={language}
                        />
                      </div>
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
                              ? question.scaleLabels?.left.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.left.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.right.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.right.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {question.type === 'searchable-dropdown' && (
                    <div className="searchable-dropdown-container">
                      <SearchableDropdown
                        question={question}
                        selectedValue={getCurrentAnswers()[question.id] || ''}
                        onSelect={(optionId) => handleSearchableDropdownAnswer(question.id, optionId)}
                        language={language}
                      />
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
                  disabled={Object.keys(getCurrentAnswers()).length < 4}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : showSecondPage ? (
            // 第2页: About Professional Work & Teamwork (questions 6-16)
            <div className="first-page-questions">
              <h1 className="section-title">
                {(() => {
                  // Check if user answered "No" to question 4 (corporate experience)
                  const question4Answer = getCurrentAnswers()['other_4'];
                  const hasNoCorporateExperience = question4Answer === 'B'; // B = No
                  
                  if (hasNoCorporateExperience) {
                    return language === 'en' 
                      ? 'I. About Teamwork' 
                      : 'I. 关于团队合作';
                  } else {
                    return language === 'en' 
                      ? 'I. About Professional Work' 
                      : 'I. 关于职业工作';
                  }
                })()}
              </h1>
              
              {getQuestionsForSectionIndex(1).map((question) => (
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
                        onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}

                  {question.type === 'email' && (
                    <EmailVerificationQuestion
                      questionId={question.id}
                      value={getCurrentAnswers()[question.id] || ''}
                      onChange={(value) => handleTextAnswer(question.id, value)}
                      onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                    />
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
                              ? question.scaleLabels?.left.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.left.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.right.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.right.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
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
                  disabled={Object.keys(getCurrentAnswers()).length < 11}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : showThirdPage ? (
            // 第3页: About Us, CHON (Section 2)
            <div className="first-page-questions">
              <h1 className="section-title">
                {getSectionTitle(2)}
              </h1>
              
              {getQuestionsForSectionIndex(2).map((question) => (
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
                        onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}

                  {question.type === 'email' && (
                    <EmailVerificationQuestion
                      questionId={question.id}
                      value={getCurrentAnswers()[question.id] || ''}
                      onChange={(value) => handleTextAnswer(question.id, value)}
                      onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                    />
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
                              ? question.scaleLabels?.left.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.left.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.right.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.right.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
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
                  disabled={Object.keys(getCurrentAnswers()).length < 15}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : showFourthPage ? (
            // 第4页: About Motherhood (Section 3)
            <div className="first-page-questions">
              <h1 className="section-title">
                {getSectionTitle(3)}
              </h1>
              
              {getQuestionsForSectionIndex(3).map((question) => (
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
                        onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                        placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                      />
                    </div>
                  )}

                  {question.type === 'email' && (
                    <EmailVerificationQuestion
                      questionId={question.id}
                      value={getCurrentAnswers()[question.id] || ''}
                      onChange={(value) => handleTextAnswer(question.id, value)}
                      onKeyDown={(e) => handleTextInputKeyPress(question.id, e)}
                    />
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
                              ? question.scaleLabels?.left.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.left.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
                          </span>
                          <span className="scale-extreme-label">
                            {language === 'en' 
                              ? question.scaleLabels?.right.en.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>) 
                              : question.scaleLabels?.right.zh.split(' – ').map((part: string, i: number) => <span key={i}>{part}</span>)}
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
                    setShowSixthPage(true);
                    // 添加自动滚动功能
                    setTimeout(scrollToFirstQuestionOfNextPage, 100);
                  }}
                  disabled={Object.keys(getCurrentAnswers()).length < 11}
                >
                  {language === 'en' ? 'Continue' : '继续'}
                </button>
              </div>
            </div>
          ) : null
        }

        {/* 其他问卷第六页 - Final Question */}
        {
          showSixthPage ? (
            <div className="questions-section">
              {getQuestionsForSectionIndex(4).map((question) => (
                <div 
                  key={question.id}
                  id={`question-${question.id}`}
                  className={`question-container ${question.type === 'scale-question' ? 'scale-question-container' : ''} question-visible final-question`}
                >
                  {renderQuestionText(question)}
                  
                  {question.type === 'multiple-choice' && question.options && (
                    <div>
                      <div className="answer-options">
                        {question.options.map((option) => (
                          <div
                            key={option.id}
                            className={`answer-option ${getCurrentAnswers()[question.id] === option.id ? 'selected' : ''}`}
                            onClick={() => handleMultipleChoiceAnswer(question.id, option.id)}
                          >
                            <p>{language === 'en' ? option.textEn : option.textZh}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null
        }
      </div>
    );
  };

  const renderBothQuestionnaire = () => {
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
        showOnlyQuestion={showOnlyQuestion}
        scrollToNextQuestion={scrollToNextQuestion}
        calculatedQuestionnaireProgress={calculatedQuestionnaireProgress}
        finishQuestionnaire={finishQuestionnaire}
      />
    );
  };

  const isFinishingRef = useRef(false);

  type FinishAnswersSnapshot = {
    answers?: Record<string, string>;
    primaryAnswers?: Record<string, string>;
    secondaryAnswers?: Record<string, string>;
  };

  const finishQuestionnaire = async (snapshot?: FinishAnswersSnapshot) => {
    if (isFinishingRef.current) {
      return;
    }
    isFinishingRef.current = true;
    try {
    let allResponses: QuestionResponse[] = [];
    let mergedForTagReplay: Record<string, string> | null = null;
    let questionsForTagReplay: QuestionForTagReconstruction[] | null = null;

    if (activeQuestionnaire === 'both') {
      const primaryQuestions = questionnaires.both.questions;
      const prim = snapshot?.primaryAnswers ?? primaryAnswers;
      const sec = snapshot?.secondaryAnswers ?? secondaryAnswers;
      mergedForTagReplay = { ...prim, ...sec };
      questionsForTagReplay = primaryQuestions as QuestionForTagReconstruction[];
      allResponses = prepareQuestionResponses(
        'both',
        primaryQuestions as { id: string; type: QuestionType }[],
        mergedForTagReplay
      );
    } else if (activeQuestionnaire) {
      const questions = questionnaires[activeQuestionnaire].questions;
      mergedForTagReplay = snapshot?.answers ?? answers;
      questionsForTagReplay = questions as QuestionForTagReconstruction[];
      allResponses = prepareQuestionResponses(
        activeQuestionnaire,
        questions,
        mergedForTagReplay
      );
    }

    // Recompute `questionScores_*` from the merged answers we save, so tag stats / character
    // matching cannot drift from stale localStorage (previously mitigated by clearing progress
    // when forking sessions on email change; one-session policy keeps one id without that wipe).
    const tagScoresForSubmit =
      mergedForTagReplay && questionsForTagReplay?.length
        ? rebuildQuestionScoreMapsFromMergedAnswers(mergedForTagReplay, questionsForTagReplay)
        : buildTagScoreArraysFromLocalStorage();
    const computedTagStats = calculateAndSaveTagStats(tagScoresForSubmit);
    setTagScores(tagScoresForSubmit);

    // Persist merged answers immediately so Results (and any effect ordering) always see Q25.
    if (mergedForTagReplay) {
      try {
        if (activeQuestionnaire === 'both') {
          const prim = snapshot?.primaryAnswers ?? primaryAnswers;
          const sec = snapshot?.secondaryAnswers ?? secondaryAnswers;
          localStorage.setItem('chon_personality_both_primary_answers', JSON.stringify(prim));
          localStorage.setItem('chon_personality_both_secondary_answers', JSON.stringify(sec));
          localStorage.setItem('chon_personality_answers', JSON.stringify({ ...prim, ...sec }));
        } else if (activeQuestionnaire) {
          localStorage.setItem('chon_personality_answers', JSON.stringify(mergedForTagReplay));
        }
      } catch (e) {
        console.warn('Could not persist personality answers before server save:', e);
      }
    }

    const completionQ25Letter = (() => {
      if (activeQuestionnaire === 'both') {
        const merged = {
          ...(snapshot?.primaryAnswers ?? primaryAnswers),
          ...(snapshot?.secondaryAnswers ?? secondaryAnswers)
        };
        const q25 = questionnaires.both.questions.find(q => q.unifiedId === 25);
        if (!q25) return '';
        const raw = merged[q25.id];
        const t = raw != null ? String(raw).trim() : '';
        return /^[A-Fa-f]$/.test(t) ? t.toUpperCase() : '';
      }
      if (activeQuestionnaire) {
        const mergedSingle = snapshot?.answers ?? answers;
        const q25 = questionnaires[activeQuestionnaire].questions.find(q => q.unifiedId === 25);
        if (!q25) return '';
        const raw = mergedSingle[q25.id];
        const t = raw != null ? String(raw).trim() : '';
        return /^[A-Fa-f]$/.test(t) ? t.toUpperCase() : '';
      }
      return '';
    })();
    
    let effectiveSessionId = userSessionId || localStorage.getItem('userSessionId');
    if (!effectiveSessionId) {
      const qType =
        activeQuestionnaire ||
        (localStorage.getItem('userSessionQuestionnaireType') as QuestionnaireType | null) ||
        undefined;
      const session = await userSessionApi.createUserSession(
        userChoice || undefined,
        undefined,
        qType,
        selectedCorporateRole || undefined
      );
      effectiveSessionId = session.user_session_id;
      setUserSessionId(effectiveSessionId);
      localStorage.setItem('userSessionId', effectiveSessionId);
    }

    // Save to backend
    try {
      if (allResponses.length === 0) {
        throw new Error(
          'No answers were assembled for saving. Try the last question again, or refresh the page.'
        );
      }
      // 一次性保存所有回答 (with user_session_id for individual tracking)
      await questionnaireApi.saveAllQuestionResponses(allResponses, effectiveSessionId || undefined);
      
      // If we have a user session, save tag scores and statistics to backend
      if (effectiveSessionId) {
        // Collect tag scores from localStorage (row per question per tag)
        const tagScoresToSave: Array<{tag_english: string, unified_question_id: number, score: number}> = [];
        
        // Prefer live `activeQuestionnaire`, then first saved row (covers rare stale React state).
        const questionnaireTypeForScores = (
          activeQuestionnaire ||
          (allResponses[0]?.questionnaire_type as QuestionnaireType | undefined) ||
          (localStorage.getItem('userSessionQuestionnaireType') as QuestionnaireType | null) ||
          'mother'
        ) as QuestionnaireType;
        const questionLookup = new Map<string, Question>();
        questionnaires[questionnaireTypeForScores]?.questions.forEach((question) => {
          questionLookup.set(question.id, question);
        });

        CHINESE_TAGS.forEach(chineseTag => {
          const englishTag = toEnglishTag(chineseTag);
          const savedMap = localStorage.getItem(`questionScores_${englishTag}`);
          if (savedMap) {
            try {
              const questionScoreMap = JSON.parse(savedMap) as Record<string, number>;
              Object.entries(questionScoreMap).forEach(([questionId, score]) => {
                const question = questionLookup.get(questionId);
                if (!question) {
                  console.warn('Skipping tag score without question metadata:', questionId);
                  return;
                }
                const unifiedId = question.unifiedId ?? parseInt(questionId.split('_')[1] || '0', 10);
                if (unifiedId) {
                  const n = typeof score === 'number' ? score : Number(score);
                  tagScoresToSave.push({
                    tag_english: englishTag,
                    unified_question_id: unifiedId,
                    score: Number.isFinite(n) ? n : 0
                  });
                }
              });
            } catch (e) {
              console.error(`Error parsing tag scores for ${englishTag}:`, e);
            }
          }
        });
        
        console.log('Saving tag scores to backend:', tagScoresToSave.length);
        if (tagScoresToSave.length > 0) {
          await userSessionApi.saveTagScores(effectiveSessionId, tagScoresToSave);
        }

        const persistedPercentage = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

        // Always send one row per canonical tag (matches Flask EXPECTED_TAG_STATISTICS_TAGS)
        const statisticsToSave = CHINESE_TAGS.map((chineseTag) => {
          const stats = computedTagStats[chineseTag];
          if (!stats || typeof stats.scorePercentage !== 'number' || Number.isNaN(stats.scorePercentage)) {
            throw new Error(
              `Incomplete tag statistics before results (${chineseTag}). Try the last question again.`
            );
          }
          return {
            tag_english: toEnglishTag(chineseTag),
            user_score: Math.round(stats.userScore),
            total_possible_score: Math.round(stats.totalPossibleScore),
            score_percentage: persistedPercentage(stats.scorePercentage),
            answered_questions: Math.round(stats.answeredQuestions),
            question_25_bonus_applied: false,
            question_25_bonus_tag: undefined
          };
        });

        console.log('Saving tag statistics to backend:', statisticsToSave.length);
        await userSessionApi.saveTagStatistics(effectiveSessionId, statisticsToSave);

        const finalScores = buildFinalScoresForMatching(computedTagStats, completionQ25Letter);
        if (!finalScores) {
          throw new Error('incomplete_tag_stats_for_character_matches');
        }
        const sortedForSave = sortCharactersForPersistence(finalScores, completionQ25Letter || undefined);
        if (sortedForSave.length !== CHARACTER_MATCH_SORT_INPUT.length) {
          throw new Error('character_rank_incomplete');
        }
        const matchesPayload = buildCharacterMatchRowsFromSorted(
          sortedForSave,
          finalScores,
          completionQ25Letter || undefined
        );
        await userSessionApi.saveCharacterMatches(effectiveSessionId, matchesPayload);
        localStorage.setItem(`characterMatchesSaved_${effectiveSessionId}`, 'true');
      }
      
      // Save succeeded — mark complete and go to results (pass computed stats so Results
      // never depends on a localStorage read race on first paint).
      localStorage.setItem('chon_questionnaire_completed', 'true');
      localStorage.setItem('chon_personality_flow_step', '5');
      navigate('/personality-test/results', {
        replace: true,
        state: {
          resultsBootstrap: {
            tagStats: computedTagStats,
            q25Letter: completionQ25Letter
          }
        }
      });
    } catch (error) {
      console.error('Error during questionnaire completion:', error);
      const detail =
        error instanceof Error && error.message.trim()
          ? error.message.trim().slice(0, 500)
          : '';
      const head =
        language === 'en'
          ? 'Could not save your answers. Please check your connection and try again.'
          : '无法保存您的答案，请检查网络后重试。';
      window.alert(detail ? `${head}\n\n${detail}` : head);
    }
    } finally {
      isFinishingRef.current = false;
    }
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
    const wrappedQuestion = `<span lang="${language}">${t.intro.question}</span>`;
    
    return (
      <div className="intro-content" lang={language}>
        <h1 className="intro-question" 
            dangerouslySetInnerHTML={{ __html: wrappedQuestion }}
            lang={language}>
        </h1>
        
        {!hasUserChosen ? (
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
              {introStats.loading ? (
                <div className="loading-indicator">
                  {language === 'en' ? 'Loading real-time stats...' : '加载实时统计数据...'}
                </div>
              ) : (
                <>
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
                  <div className="stats-info" lang={language}>
                    {language === 'en' 
                      ? `Based on ${introStats.yesCount + introStats.noCount} responses` 
                      : `基于 ${introStats.yesCount + introStats.noCount} 个回答`}
                  </div>
                </>
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
                      localStorage.setItem('selectedCorporateRole', role);
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
                  <span className="continue-text">{language === 'en' ? 'CONTINUE' : '继续'}</span>
                  <span className="continue-arrow">→</span>
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
            <span className="continue-text">{language === 'en' ? 'CONTINUE' : '继续'}</span>
            <span className="continue-arrow">→</span>
          </button>
        )}
      </div>
    );
  };

  // 在多个地方复用的问题文本渲染函数
  const renderQuestionText = (question: Question) => {
    let questionText = language === 'en' ? question.textEn : question.textZh;

    if (activeQuestionnaire && question.unifiedId) {
      const config = questionnaireConfigs[activeQuestionnaire];
      const conditionalMods = config?.conditionalModifications?.[question.unifiedId];

      if (conditionalMods) {
        for (const condMod of conditionalMods) {
          const conditionQuestionIndex = config.questionIds.indexOf(condMod.condition.questionId);
          if (conditionQuestionIndex !== -1) {
            const conditionQuestionId = `${activeQuestionnaire}_${conditionQuestionIndex + 1}`;
            const userAnswer = getCurrentAnswers()[conditionQuestionId];

            if (userAnswer === condMod.condition.answer) {
              questionText = language === 'en'
                ? condMod.modifications.textEn || questionText
                : condMod.modifications.textZh || questionText;
              break;
            }
          }
        }
      }
    }

    return (
      <h2 className="question-text">
        {questionText}
        {/* 标签不再前端显示，但数据仍保留在question对象中用于后续分析 */}
      </h2>
    );
  };

  /** Unified Q1: A = female, B = male — used for conditionalTags questions. */
  const getBiologicalSexAnswer = (): string | undefined => {
    const qs = getCurrentQuestions();
    const q1 = qs.find((q) => q.unifiedId === 1);
    if (!q1) return undefined;
    return getCurrentAnswers()[q1.id];
  };

  // 当用户回答问题时，更新相应标签的得分
  const updateTagScores = (questionId: string, value: string) => {
    const question = getCurrentQuestions().find(q => q.id === questionId);
    if (!question) return;

    const englishTags = resolveEffectiveTagEnglishList(question, getBiologicalSexAnswer());
    if (englishTags.length === 0) return;
    
    console.log(`处理问题 ${questionId} 的回答，值: ${value}, 类型: ${question.type}`);
    
    // 对于量表问题，处理分数转换
    let score: number;
    if (question.type === 'scale-question') {
      score = scaleValueToPercentage(value);
      console.log(`问题 ${questionId} 的分数已转换: ${value} -> ${score}%`);
    } else {
      // 对于多选题，暂时只记录选择了哪个选项，不计算分数
      score = 0;
    }
    
    // 为每个标签更新分数
    const newTagScores = {...tagScores};
    
    // 创建问题ID到分数的映射
    const questionScoreMap: Record<string, Record<string, number>> = {};
    
    // 从localStorage加载现有的问题ID-分数映射
    englishTags.forEach(englishTag => {
      const chineseTag = toChineseTag(englishTag);
      if (!chineseTag) return;
      
      // Use English tag for localStorage key
      const savedMap = localStorage.getItem(`questionScores_${englishTag}`);
      if (savedMap) {
        try {
          questionScoreMap[chineseTag] = JSON.parse(savedMap);
        } catch (e) {
          console.error(`解析标签 ${englishTag} 的问题分数映射出错:`, e);
          questionScoreMap[chineseTag] = {};
        }
      } else {
        questionScoreMap[chineseTag] = {};
      }
      
      // 更新当前问题的分数
      questionScoreMap[chineseTag][questionId] = score;
      
      // 保存更新后的映射 (using English tag for localStorage key)
      localStorage.setItem(`questionScores_${englishTag}`, JSON.stringify(questionScoreMap[chineseTag]));
      
      // 将所有问题的分数转换为数组
      if (!newTagScores[chineseTag]) {
        newTagScores[chineseTag] = [];
      }
      
      // 将问题分数映射的值填入数组
      const scoreArray = Object.values(questionScoreMap[chineseTag]);
      newTagScores[chineseTag] = scoreArray;
      
      console.log(`更新标签 ${chineseTag} 的分数，问题 ${questionId}: ${score}`);
      console.log(`标签 ${chineseTag} 的问题-分数映射:`, questionScoreMap[chineseTag]);
    });
    
    setTagScores(newTagScores);
    
    // 保存标签分数到本地存储
    localStorage.setItem('tagScores', JSON.stringify(newTagScores));
    
    // 计算并保存标签总分和比例
    calculateAndSaveTagStats(newTagScores);
    
    console.log(`标签分数已更新并保存:`, newTagScores);

    const sessionId = userSessionId || localStorage.getItem('userSessionId');
    const unifiedQuestionId = question.unifiedId ?? parseInt(questionId.split('_')[1] || '0', 10);
    if (sessionId && unifiedQuestionId && englishTags.length > 0) {
      const tagScoresToSave = englishTags.map((englishTag) => ({
        tag_english: englishTag,
        unified_question_id: unifiedQuestionId,
        score
      }));
      void userSessionApi.saveTagScores(sessionId, tagScoresToSave).catch((err) => {
        console.warn('Incremental tag score sync skipped:', err);
      });
    }
  };

  // 计算并保存每个标签的统计数据（总分、平均分、比例等）
  const calculateAndSaveTagStats = useCallback((currentTagScores: Record<string, number[]>) => {
    // 计算每个标签的统计数据
    const tagStats = calculateTagStats(currentTagScores);
    
    // 保存标签统计数据到本地存储
    localStorage.setItem('tagStats', JSON.stringify(tagStats));
    
    // 打印统计信息的表格
    console.log('==== 标签得分统计 ====');
    console.table(tagStats);
    
    return tagStats;
  }, []);

  // 在useEffect中添加从localStorage读取标签得分和统计数据的代码
  useEffect(() => {
    // 使用集中定义的标签
    const loadedTagScores: Record<string, number[]> = {};
    
    // 从问题分数映射中加载标签分数 (use English tags for localStorage keys)
    CHINESE_TAGS.forEach(chineseTag => {
      const englishTag = toEnglishTag(chineseTag);
      const savedMap = localStorage.getItem(`questionScores_${englishTag}`);
      if (savedMap) {
        try {
          const questionScoreMap = JSON.parse(savedMap);
          // 将问题分数映射的值填入数组
          loadedTagScores[chineseTag] = Object.values(questionScoreMap);
          console.log(`成功加载标签 ${englishTag} 的问题分数映射:`, questionScoreMap);
        } catch (e) {
          console.error(`解析标签 ${englishTag} 的问题分数映射出错:`, e);
          loadedTagScores[chineseTag] = [];
        }
      } else {
        // 尝试从旧格式加载 (旧版本使用中文标签作为key)
        const savedTagScores = localStorage.getItem('tagScores');
        if (savedTagScores) {
          try {
            const parsedScores = JSON.parse(savedTagScores);
            if (parsedScores[chineseTag]) {
              loadedTagScores[chineseTag] = parsedScores[chineseTag];
            } else {
              loadedTagScores[chineseTag] = [];
            }
          } catch (e) {
            console.error('解析旧格式标签分数出错:', e);
            loadedTagScores[chineseTag] = [];
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
  }, [calculateAndSaveTagStats]);

  const renderPrivacyStatement = () => {
    const currentQuestionnaire = getCurrentQuestionnaire();
    
    if (!currentQuestionnaire) {
      return null;
    }
    
    // 根据问卷类型添加相应的CSS类
    const privacyClass = currentQuestionnaire.type === 'other' ? 'other-privacy' : 'mother-privacy';
    
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
