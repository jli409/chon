import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

interface EmailVerificationQuestionProps {
  questionId: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const EmailVerificationQuestion: React.FC<EmailVerificationQuestionProps> = ({
  questionId,
  value,
  onChange,
  onKeyDown
}) => {
  const { language } = useLanguage();

  return (
    <div className="text-input-container">
      <input
        type="email"
        className="text-answer-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={language === 'en' ? 'your.email@company.com' : '您的邮箱@公司.com'}
      />
    </div>
  );
};

export default EmailVerificationQuestion;

