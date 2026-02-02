// Tag utility functions for consistent tag mapping and scoring across the application

// Tag mapping from English to Chinese
export const TAG_MAPPING: Record<string, string> = {
  'selfAwareness': '自我意识',
  'dedication': '奉献精神', 
  'socialIntelligence': '社交情商',
  'emotionalRegulation': '情绪调节',
  'objectivity': '客观能力',
  'coreEndurance': '核心耐力'
};

// Reverse mapping from Chinese to English
export const REVERSE_TAG_MAPPING: Record<string, string> = {
  '自我意识': 'selfAwareness',
  '奉献精神': 'dedication',
  '社交情商': 'socialIntelligence',
  '情绪调节': 'emotionalRegulation',
  '客观能力': 'objectivity',
  '核心耐力': 'coreEndurance'
};

// All English tags
export const ENGLISH_TAGS = ['selfAwareness', 'dedication', 'socialIntelligence', 'emotionalRegulation', 'objectivity', 'coreEndurance'];

// All Chinese tags
export const CHINESE_TAGS = ['自我意识', '奉献精神', '社交情商', '情绪调节', '客观能力', '核心耐力'];

// Convert scale value to percentage
// Only supports 5-point scale (1-5)
export const scaleValueToPercentage = (value: string | number): number => {
  let rawScore: number;
  
  if (typeof value === 'string') {
    if (['A', 'B', 'C', 'D', 'E'].includes(value)) {
      // Map A-E to 1-5 (5-point scale)
      const scoreMap: Record<string, number> = {'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5};
      rawScore = scoreMap[value] || 0;
    } else {
      // Parse numeric string
      rawScore = parseInt(value, 10) || 0;
    }
  } else {
    rawScore = value;
  }
  
  // 5-point scale: 1=20%, 2=40%, 3=60%, 4=80%, 5=100%
  return rawScore * 20;
};

// Convert English tag to Chinese tag
export const toChineseTag = (englishTag: string): string => {
  return TAG_MAPPING[englishTag] || englishTag;
};

// Convert Chinese tag to English tag
export const toEnglishTag = (chineseTag: string): string => {
  return REVERSE_TAG_MAPPING[chineseTag] || chineseTag;
};

// Calculate tag statistics
export interface TagStats {
  userScore: number;
  totalPossibleScore: number;
  scorePercentage: number;
  averageScore: number;
  answeredQuestions: number;
}

export const calculateTagStats = (
  currentTagScores: Record<string, number[]>
): Record<string, TagStats> => {
  const tagStats: Record<string, TagStats> = {};
  
  CHINESE_TAGS.forEach(chineseTag => {
    const scores = currentTagScores[chineseTag] || [];
    // Only count valid scores (greater than 0)
    const validScores = scores.filter(score => score > 0);
    const userScore = validScores.reduce((sum, score) => sum + score, 0);
    const answeredQuestions = validScores.length;
    // Use answered questions count instead of total possible questions count
    // This accounts for questions with multiple tags
    const totalPossibleScore = answeredQuestions * 100; // Each answered question max 100%
    const scorePercentage = totalPossibleScore > 0 ? (userScore / totalPossibleScore) * 100 : 0;
    const averageScore = answeredQuestions > 0 ? userScore / answeredQuestions : 0;
    
    tagStats[chineseTag] = {
      userScore,
      totalPossibleScore,
      scorePercentage,
      averageScore,
      answeredQuestions
    };
  });
  
  return tagStats;
};

// Count questions per tag
type QuestionLike = {
  type: string;
  tags?: string[];
};

export const countQuestionsPerTag = (questions: QuestionLike[]): Record<string, number> => {
  const tagQuestionCounts: Record<string, number> = {};
  
  questions.forEach(question => {
    if (question.type === 'scale-question' && question.tags) {
      question.tags.forEach((englishTag: string) => {
        const chineseTag = toChineseTag(englishTag);
        if (chineseTag) {
          if (!tagQuestionCounts[chineseTag]) {
            tagQuestionCounts[chineseTag] = 0;
          }
          tagQuestionCounts[chineseTag] += 1;
        }
      });
    }
  });
  
  return tagQuestionCounts;
};
