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

/** Minimal shape for resolving which English tags a question affects. */
export type TagsResolvableQuestion = {
  tags?: string[];
  conditionalTags?: {
    male?: string[];
    female?: string[];
  };
};

/**
 * Effective English tags for scoring: uses `tags`, or `conditionalTags` based on Q1 sex
 * (A = female, B = male in unified question 1).
 */
export const resolveEffectiveTagEnglishList = (
  question: TagsResolvableQuestion,
  biologicalSexAnswer: string | null | undefined
): string[] => {
  if (question.tags && question.tags.length > 0) {
    return [...question.tags];
  }
  const ct = question.conditionalTags;
  if (!ct) {
    return [];
  }
  const sex = biologicalSexAnswer?.trim().toUpperCase();
  if (sex === 'A' && ct.female?.length) {
    return [...ct.female];
  }
  if (sex === 'B' && ct.male?.length) {
    return [...ct.male];
  }
  return [];
};

/**
 * Rebuild per-tag score arrays from `questionScores_<englishTag>` localStorage keys
 * (same source as incremental updates). Prefer this over React state at submit time.
 */
export const buildTagScoreArraysFromLocalStorage = (): Record<string, number[]> => {
  const loadedTagScores: Record<string, number[]> = {};
  CHINESE_TAGS.forEach((chineseTag) => {
    const englishTag = toEnglishTag(chineseTag);
    const savedMap = localStorage.getItem(`questionScores_${englishTag}`);
    if (savedMap) {
      try {
        const questionScoreMap = JSON.parse(savedMap) as Record<string, number>;
        loadedTagScores[chineseTag] = Object.values(questionScoreMap);
      } catch {
        loadedTagScores[chineseTag] = [];
      }
    } else {
      loadedTagScores[chineseTag] = [];
    }
  });
  return loadedTagScores;
};

/** Minimal question shape for replaying scores from a full answer map (must match `updateTagScores` rules). */
export type QuestionForTagReconstruction = TagsResolvableQuestion & {
  id: string;
  type: string;
  unifiedId?: number;
};

/**
 * Rebuild `questionScores_<tag>` maps from the merged answer object so tag stats match answers on submit.
 * Important after flows that no longer clear local tag state (e.g. same session + email edits on verify).
 */
export const rebuildQuestionScoreMapsFromMergedAnswers = (
  mergedAnswers: Record<string, string>,
  questions: QuestionForTagReconstruction[]
): Record<string, number[]> => {
  const q1 = questions.find((q) => q.unifiedId === 1);
  const sex = q1 ? mergedAnswers[q1.id] : undefined;
  const perEnglish: Record<string, Record<string, number>> = {};
  for (const en of ENGLISH_TAGS) {
    perEnglish[en] = {};
  }

  for (const q of questions) {
    const val = mergedAnswers[q.id];
    if (val == null) {
      continue;
    }
    const strVal = typeof val === 'string' ? val : String(val);
    if (strVal.trim() === '') {
      continue;
    }
    const englishTags = resolveEffectiveTagEnglishList(q, sex);
    if (englishTags.length === 0) {
      continue;
    }
    const raw = q.type === 'scale-question' ? scaleValueToPercentage(strVal) : 0;
    const score = Number.isFinite(raw) ? raw : 0;
    for (const en of englishTags) {
      perEnglish[en][q.id] = score;
    }
  }

  const tagScores: Record<string, number[]> = {};
  for (const chineseTag of CHINESE_TAGS) {
    const en = toEnglishTag(chineseTag);
    const map = perEnglish[en] || {};
    try {
      localStorage.setItem(`questionScores_${en}`, JSON.stringify(map));
    } catch (e) {
      throw new Error(
        `Could not save tag working data (${en}). Storage may be full or blocked — try clearing site data for this site. ${e instanceof Error ? e.message : ''}`.trim()
      );
    }
    tagScores[chineseTag] = Object.values(map);
  }
  try {
    localStorage.setItem('tagScores', JSON.stringify(tagScores));
  } catch (e) {
    throw new Error(
      `Could not save tag summary to storage. ${e instanceof Error ? e.message : String(e)}`.trim()
    );
  }
  return tagScores;
};

export const calculateTagStats = (
  currentTagScores: Record<string, number[]>
): Record<string, TagStats> => {
  const tagStats: Record<string, TagStats> = {};
  
  CHINESE_TAGS.forEach(chineseTag => {
    const scores = currentTagScores[chineseTag] || [];
    // Only count valid scores (greater than 0, finite — avoids NaN from bad storage)
    const validScores = scores.filter((score) => score > 0 && Number.isFinite(score));
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
