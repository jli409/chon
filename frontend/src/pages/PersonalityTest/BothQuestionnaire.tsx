import React from 'react';
import { questionnaires } from './questionnaires';
import SearchableDropdown from './SearchableDropdown';


// 不使用严格的类型检查，改用更宽松的类型以适应所有问题类型
interface QuestionBase {
  id: string;
  type: string;
  textEn: string;
  textZh: string;
  options?: { id: string; textEn: string; textZh: string; }[];
  scaleLabels?: { 
    left: {
      en: string;
      zh: string;
    };
    right: {
      en: string;
      zh: string;
    };
  };
  tags?: string[];
}

// Define option type to fix 'any' type issues
interface OptionType {
  id: string;
  textEn: string;
  textZh: string;
}

interface BothQuestionnaireProps {
  language: string;
  getCurrentAnswers: () => Record<string, string>;
  handleMultipleChoiceAnswer: (questionId: string, optionId: string) => void;
  handleTextAnswer: (questionId: string, text: string) => void;
  handleScaleAnswer: (questionId: string, value: string) => void;
  showFirstPage: boolean;
  showSecondPage: boolean;
  showThirdPage: boolean;
  showFourthPage: boolean;
  showFifthPage: boolean;
  showSixthPage: boolean;
  setShowFirstPage: (value: boolean) => void;
  setShowSecondPage: (value: boolean) => void;
  setShowThirdPage: (value: boolean) => void;
  setShowFourthPage: (value: boolean) => void;
  setShowFifthPage: (value: boolean) => void;
  setShowSixthPage: (value: boolean) => void;
  scrollToFirstQuestionOfNextPage: () => void;
  showOnlyQuestion: (questionId: string) => void;
  scrollToNextQuestion: (questionId: string) => void;
  calculatedQuestionnaireProgress: () => number;
  finishQuestionnaire: () => void;
}

const BothQuestionnaire: React.FC<BothQuestionnaireProps> = ({
  language,
  getCurrentAnswers,
  handleMultipleChoiceAnswer,
  handleTextAnswer,
  handleScaleAnswer,
  showFirstPage,
  showSecondPage,
  showThirdPage,
  showFourthPage,
  showFifthPage,
  showSixthPage,
  setShowFirstPage,
  setShowSecondPage,
  setShowThirdPage,
  setShowFourthPage,
  setShowFifthPage,
  setShowSixthPage,
  scrollToFirstQuestionOfNextPage,
  showOnlyQuestion,
  scrollToNextQuestion,
  calculatedQuestionnaireProgress,
  finishQuestionnaire
}) => {
  // Helper function to render question text
  const renderQuestionText = (question: any) => {
    return (
      <h2 className="question-text">
        {language === 'en' ? question.textEn : question.textZh}
      </h2>
    );
  };
  const bothQuestions = questionnaires.both.questions;
  const page1Questions: any[] = bothQuestions.slice(0, 15); // Demographics & Background (both 1-15)
  const page2Questions: any[] = bothQuestions.slice(15, 28); // About Your Leadership (both 16-28)
  const page3Questions: any[] = bothQuestions.slice(28, 39); // About Work-Life Balance (both 29-39)
  const page4Questions: any[] = bothQuestions.slice(39, 53); // About Us, CHON (both 40-53)
  const page5Questions: any[] = bothQuestions.slice(53, 66); // About Motherhood (both 54-66)
  const page6Question: any = bothQuestions[66]; // Question 25 - Final Question (both 67)

  return (
    <div className="questionnaire-content both-questionnaire" lang={language}>
      {/* Progress bar */}
      <div className="question-progress-container">
        <div className="question-progress-bar">
          <div 
            className="question-progress-fill" 
            style={{ width: `${calculatedQuestionnaireProgress()}%` }}
          ></div>
        </div>
      </div>
      
      {/* Page 1 - Demographics & Background */}
      {showFirstPage && (
        <div className="first-page-questions first-page-true">
          {page1Questions.map((question) => (
            <div key={question.id} id={`question-${question.id}`} className="question-container">
              {renderQuestionText(question)}
              
              {question.type === 'multiple-choice' ? (
                <div className="answer-options">
                  {question.options?.map((option: OptionType) => (
                    <div 
                      key={option.id}
                      className={`answer-option ${getCurrentAnswers()[question.id] === option.id ? 'selected' : ''}`}
                      onClick={() => handleMultipleChoiceAnswer(question.id, option.id)}
                    >
                      <p>{option.id}) {language === 'en' ? option.textEn : option.textZh}</p>
                    </div>
                  ))}
                </div>
              ) : question.type === 'searchable-dropdown' ? (
                <SearchableDropdown
                  question={question}
                  selectedValue={getCurrentAnswers()[question.id] || ''}
                  onSelect={(value: string) => handleMultipleChoiceAnswer(question.id, value)}
                  language={language}
                />
              ) : question.type === 'text-with-unit' ? (
                <div className="text-with-unit-container">
                  <input
                    type="text"
                    className="text-answer-input text-with-unit-input"
                    value={getCurrentAnswers()[question.id]?.split('_')[0] || ''}
                    onChange={(e) => {
                      const unit = getCurrentAnswers()[question.id]?.split('_')[1] || 'kg';
                      handleTextAnswer(question.id, `${e.target.value}_${unit}`);
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && getCurrentAnswers()[question.id]) {
                        const currentIndex = page1Questions.findIndex(q => q.id === question.id);
                        if (currentIndex < page1Questions.length - 1) {
                          const nextQuestion = page1Questions[currentIndex + 1];
                          showOnlyQuestion(nextQuestion.id);
                          scrollToNextQuestion(question.id);
                        }
                      }
                    }}
                    placeholder={language === 'en' ? 'Enter weight' : '输入体重'}
                  />
                  <div className="unit-selector">
                    <SearchableDropdown
                      question={{
                        ...question,
                        id: `${question.id}_unit`
                      }}
                      selectedValue={getCurrentAnswers()[question.id]?.split('_')[1] || 'kg'}
                      onSelect={(unitId: string) => {
                        const value = getCurrentAnswers()[question.id]?.split('_')[0] || '';
                        handleTextAnswer(question.id, `${value}_${unitId}`);
                      }}
                      language={language}
                    />
                  </div>
                </div>
              ) : question.type === 'text-input' ? (
                <div className="text-input-container">
                  <input
                    type="text"
                    className="text-answer-input"
                    value={getCurrentAnswers()[question.id] || ''}
                    onChange={(e) => handleTextAnswer(question.id, e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && getCurrentAnswers()[question.id]) {
                        const currentIndex = page1Questions.findIndex(q => q.id === question.id);
                        if (currentIndex < page1Questions.length - 1) {
                          const nextQuestion = page1Questions[currentIndex + 1];
                          showOnlyQuestion(nextQuestion.id);
                          scrollToNextQuestion(question.id);
                        }
                      }
                    }}
                    placeholder={language === 'en' ? 'Enter your answer here' : '在此输入您的答案'}
                  />
                </div>
              ) : null}

              {question.type === 'email' && (
                <EmailVerificationQuestion
                  questionId={question.id}
                  value={getCurrentAnswers()[question.id] || ''}
                  onChange={(value) => handleTextAnswer(question.id, value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      // Handle enter key if needed
                    }
                  }}
                />
              )}
            </div>
          ))}
          
          <div className="question-navigation">
            <button 
              className="nav-button next-button"
              onClick={() => {
                setShowFirstPage(false);
                setShowSecondPage(true);
                setTimeout(scrollToFirstQuestionOfNextPage, 100);
              }}
              disabled={page1Questions.some(q => !getCurrentAnswers()[q.id])}
            >
              {language === 'en' ? 'Continue' : '继续'}
            </button>
          </div>
        </div>
      )}

      {/* Page 2 - About Your Leadership */}
      {showSecondPage && (
        <div className="first-page-questions">
          <h1 className="section-title">
            {language === 'en' 
              ? 'I. About Your Leadership' 
              : 'I. 关于您的领导力'}
          </h1>
          
          {page2Questions.map((question) => (
            <div 
              key={question.id} 
              id={`question-${question.id}`} 
              className={`question-container ${question.type === 'scale-question' ? 'scale-question-container' : ''}`}
            >
              {renderQuestionText(question)}
              
              {question.type === 'multiple-choice' && (
                <div className="answer-options">
                  {question.options?.map((option: OptionType) => (
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
                setTimeout(scrollToFirstQuestionOfNextPage, 100);
              }}
              disabled={page2Questions.some(q => !getCurrentAnswers()[q.id])}
            >
              {language === 'en' ? 'Continue' : '继续'}
            </button>
          </div>
        </div>
      )}

      {/* Page 3 - About Work-Life Balance */}
      {showThirdPage && (
        <div className="first-page-questions">
          <h1 className="section-title">
            {language === 'en' 
              ? 'II. About Work-Life Balance' 
              : 'II. 关于工作与生活平衡'}
          </h1>
          
          {page3Questions.map((question) => (
            <div 
              key={question.id} 
              id={`question-${question.id}`} 
              className={`question-container ${question.type === 'scale-question' ? 'scale-question-container' : ''}`}
            >
              {renderQuestionText(question)}
              
              {question.type === 'multiple-choice' && (
                <div className="answer-options">
                  {question.options?.map((option: OptionType) => (
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
                setTimeout(scrollToFirstQuestionOfNextPage, 100);
              }}
              disabled={page3Questions.some(q => !getCurrentAnswers()[q.id])}
            >
              {language === 'en' ? 'Continue' : '继续'}
            </button>
          </div>
        </div>
      )}

      {/* Page 4 - About Us, CHON */}
      {showFourthPage && (
        <div className="first-page-questions">
          <h1 className="section-title">
            {language === 'en' 
              ? 'III. About Us, CHON' 
              : 'III. 关于我们，CHON'}
          </h1>
          
          {page4Questions.map((question) => (
            <div 
              key={question.id} 
              id={`question-${question.id}`} 
              className={`question-container ${question.type === 'scale-question' ? 'scale-question-container' : ''}`}
            >
              {renderQuestionText(question)}
              
              {question.type === 'multiple-choice' && (
                <div className="answer-options">
                  {question.options?.map((option: OptionType) => (
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
                setTimeout(scrollToFirstQuestionOfNextPage, 100);
              }}
              disabled={page4Questions.some(q => !getCurrentAnswers()[q.id])}
            >
              {language === 'en' ? 'Continue' : '继续'}
            </button>
          </div>
        </div>
      )}

      {/* Page 5 - About Motherhood */}
      {showFifthPage && (
        <div className="first-page-questions">
          <h1 className="section-title">
            {language === 'en' 
              ? 'IV. About Motherhood' 
              : 'IV. 关于母亲身份'}
          </h1>
          
          {page5Questions.map((question) => (
            <div 
              key={question.id} 
              id={`question-${question.id}`} 
              className={`question-container ${question.type === 'scale-question' ? 'scale-question-container' : ''}`}
            >
              {renderQuestionText(question)}
              
              {question.type === 'multiple-choice' && (
                <div className="answer-options">
                  {question.options?.map((option: OptionType) => (
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
                setTimeout(scrollToFirstQuestionOfNextPage, 100);
              }}
              disabled={page5Questions.some(q => !getCurrentAnswers()[q.id])}
            >
              {language === 'en' ? 'Continue' : '继续'}
            </button>
          </div>
        </div>
      )}

      {/* Page 6 - Final Question (Question 25) */}
      {showSixthPage && page6Question && (
        <div className="first-page-questions">
          <div 
            key={page6Question.id} 
            id={`question-${page6Question.id}`} 
            className="question-container final-question"
          >
            {renderQuestionText(page6Question)}
            
            {page6Question.type === 'multiple-choice' && (
              <div className="answer-options">
                {page6Question.options?.map((option: OptionType) => (
                  <div 
                    key={option.id}
                    className={`answer-option ${getCurrentAnswers()[page6Question.id] === option.id ? 'selected' : ''}`}
                    onClick={() => {
                      handleMultipleChoiceAnswer(page6Question.id, option.id);
                      // Auto-finish after answering question 25
                      setTimeout(() => {
                        finishQuestionnaire();
                      }, 500);
                    }}
                  >
                    <p>{option.id}) {language === 'en' ? option.textEn : option.textZh}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BothQuestionnaire; 