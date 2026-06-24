import type { CharacterMatch } from '../api/userSession';
import { applyQuestion25Bonus, sortCharactersByMatch } from './characterMatching';
import { CHINESE_TAGS, toEnglishTag, type TagStats } from './tagUtils';

/**
 * Tag ranges per character — single source of truth for ranking vs Flask / SQL backfills.
 * (Same numeric ranges as Results.tsx cardsData.)
 */
export const CHARACTER_MATCH_SORT_INPUT: Array<{
  id: string;
  tagRanges: Record<string, [number, number]>;
}> = [
  {
    id: 'odin',
    tagRanges: {
      selfAwareness: [80, 100],
      dedication: [20, 60],
      socialIntelligence: [30, 60],
      emotionalRegulation: [40, 60],
      objectivity: [60, 80],
      coreEndurance: [40, 60]
    }
  },
  {
    id: 'wukong',
    tagRanges: {
      selfAwareness: [40, 60],
      dedication: [40, 60],
      socialIntelligence: [40, 70],
      emotionalRegulation: [80, 100],
      objectivity: [40, 60],
      coreEndurance: [40, 60]
    }
  },
  {
    id: 'prometheus',
    tagRanges: {
      selfAwareness: [30, 60],
      dedication: [80, 100],
      socialIntelligence: [30, 60],
      emotionalRegulation: [30, 50],
      objectivity: [30, 70],
      coreEndurance: [60, 80]
    }
  },
  {
    id: 'nuwa',
    tagRanges: {
      selfAwareness: [0, 40],
      dedication: [50, 80],
      socialIntelligence: [40, 60],
      emotionalRegulation: [60, 80],
      objectivity: [40, 60],
      coreEndurance: [80, 100]
    }
  },
  {
    id: 'athena',
    tagRanges: {
      selfAwareness: [60, 80],
      dedication: [0, 40],
      socialIntelligence: [50, 70],
      emotionalRegulation: [40, 60],
      objectivity: [70, 100],
      coreEndurance: [40, 60]
    }
  },
  {
    id: 'venus',
    tagRanges: {
      selfAwareness: [60, 80],
      dedication: [40, 60],
      socialIntelligence: [80, 100],
      emotionalRegulation: [40, 70],
      objectivity: [30, 60],
      coreEndurance: [20, 50]
    }
  }
];

type StatsLike = Pick<TagStats, 'scorePercentage'> | { scorePercentage?: number };

/**
 * Fill missing / invalid tag percentages with 0 so Q25 bonus and core adjustment
 * always run through {@link buildFinalScoresForMatching} with the real Q25 letter.
 */
export function normalizeTagStatsForMatching(
  statsByChinese: Record<string, StatsLike | undefined>
): Record<string, { scorePercentage: number }> {
  const out: Record<string, { scorePercentage: number }> = {};
  for (const chineseTag of CHINESE_TAGS) {
    const st = statsByChinese[chineseTag];
    const sp = st?.scorePercentage;
    const n = typeof sp === 'number' && Number.isFinite(sp) ? sp : 0;
    out[chineseTag] = { scorePercentage: n };
  }
  return out;
}

/**
 * English tag scores after Q25 bonus and the same core adjustment as Results.tsx / Flask.
 */
export function buildFinalScoresForMatching(
  statsByChinese: Record<string, StatsLike | undefined>,
  q25Letter: string
): Record<string, number> | null {
  const userScores: Record<string, number> = {};
  for (const chineseTag of CHINESE_TAGS) {
    const stats = statsByChinese[chineseTag];
    const eng = toEnglishTag(chineseTag);
    if (!stats || typeof stats.scorePercentage !== 'number' || Number.isNaN(stats.scorePercentage)) {
      return null;
    }
    userScores[eng] = stats.scorePercentage;
  }

  let finalScores = applyQuestion25Bonus(userScores, q25Letter);

  const otherTags = [
    'selfAwareness',
    'dedication',
    'socialIntelligence',
    'emotionalRegulation',
    'objectivity'
  ] as const;
  const validScores = otherTags.map(tag => finalScores[tag]).filter(v => typeof v === 'number');
  if (validScores.length === 5) {
    const avg = validScores.reduce((a, b) => a + b, 0) / 5;
    const coreStat = statsByChinese['核心耐力'];
    if (!coreStat || typeof coreStat.scorePercentage !== 'number' || Number.isNaN(coreStat.scorePercentage)) {
      return null;
    }
    let adjustedCore = finalScores.coreEndurance;
    if (avg > 60) {
      adjustedCore += avg - 60;
    }
    finalScores = { ...finalScores, coreEndurance: Math.min(100, Math.max(0, adjustedCore)) };
  }

  return finalScores;
}

/**
 * Build the six POST /character-matches rows from sorted character list (same metrics as Results).
 */
export function buildCharacterMatchRowsFromSorted(
  sortedCharacters: Array<{ id: string; tagRanges: Record<string, [number, number]> }>,
  finalScores: Record<string, number>,
  q25Letter: string | undefined
): CharacterMatch[] {
  return sortedCharacters.map((character, index) => {
    let inRangeCount = 0;
    let outOfRangeDiffSum = 0;

    Object.entries(character.tagRanges).forEach(([tag, range]) => {
      const userScore = finalScores[tag];
      if (userScore !== undefined) {
        if (userScore >= range[0] && userScore <= range[1]) {
          inRangeCount++;
        } else if (userScore < range[0]) {
          outOfRangeDiffSum += range[0] - userScore;
        } else {
          outOfRangeDiffSum += userScore - range[1];
        }
      }
    });

    const finalPercentage = (inRangeCount / 6) * 100;

    return {
      character_id: character.id.toLowerCase(),
      match_rank: index + 1,
      in_range_count: inRangeCount,
      out_of_range_diff_sum: outOfRangeDiffSum,
      final_percentage: Math.round(finalPercentage),
      question_25_answer: q25Letter || undefined
    };
  });
}

export function sortCharactersForPersistence(
  finalScores: Record<string, number>,
  q25Letter: string | undefined
): typeof CHARACTER_MATCH_SORT_INPUT {
  return sortCharactersByMatch(finalScores, CHARACTER_MATCH_SORT_INPUT, q25Letter || undefined);
}
