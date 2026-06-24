import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const START_TS = process.env.START_TS || '2026-03-24 00:00:00+00';
const UPDATE_EXISTING = process.env.UPDATE_EXISTING !== 'false';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const characters = [
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

const sortCharactersByMatch = (userScores, question25Answer) => {
  const charactersWithScores = characters.map(character => {
    let inRangeCount = 0;
    let outOfRangeDiffSum = 0;

    Object.entries(character.tagRanges).forEach(([tag, range]) => {
      const userScore = userScores[tag];
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

    return { character, inRangeCount, outOfRangeDiffSum };
  });

  const sorted = charactersWithScores.sort((a, b) => {
    if (a.inRangeCount !== b.inRangeCount) {
      return b.inRangeCount - a.inRangeCount;
    }
    if (a.outOfRangeDiffSum !== b.outOfRangeDiffSum) {
      return a.outOfRangeDiffSum - b.outOfRangeDiffSum;
    }
    if (question25Answer) {
      const answerToCharacterMap = {
        A: 'prometheus',
        B: 'wukong',
        C: 'odin',
        D: 'venus',
        E: 'nuwa',
        F: 'athena'
      };
      const preferredCharacterId = answerToCharacterMap[question25Answer];
      if (a.character.id === preferredCharacterId) return -1;
      if (b.character.id === preferredCharacterId) return 1;
    }
    return 0;
  });

  return sorted.map(item => item.character);
};

const computeAdjustedScores = (tagStats) => {
  const scores = {};
  tagStats.forEach(stat => {
    scores[stat.tag_english] = stat.score_percentage;
  });

  const otherTags = ['selfAwareness', 'dedication', 'socialIntelligence', 'emotionalRegulation', 'objectivity'];
  const validScores = otherTags.map(tag => scores[tag]).filter(v => typeof v === 'number');
  if (validScores.length === 5) {
    const avg = validScores.reduce((a, b) => a + b, 0) / 5;
    const coreStat = scores.coreEndurance;
    if (typeof coreStat === 'number' && !Number.isNaN(coreStat)) {
      let adjustedCore = coreStat;
      if (avg > 60) {
        adjustedCore += (avg - 60);
      }
      scores.coreEndurance = Math.min(100, Math.max(0, adjustedCore));
    }
  }

  return scores;
};

const getQuestion25Answer = async (userSessionId) => {
  const { data, error } = await supabase
    .from('question_responses')
    .select('response_value, created_at')
    .eq('user_session_id', userSessionId)
    .eq('original_question_id', 25)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Failed to read question 25 answer:', error);
    return null;
  }
  return data?.[0]?.response_value || null;
};

const backfill = async () => {
  const { data: sessions, error: sessionError } = await supabase
    .from('user_sessions')
    .select('id, created_at')
    .gte('created_at', START_TS);

  if (sessionError) {
    console.error('Failed to load sessions:', sessionError);
    process.exit(1);
  }

  for (const session of sessions) {
    const { data: existingMatches, error: existingError } = await supabase
      .from('character_matches')
      .select('id')
      .eq('user_session_id', session.id)
      .limit(1);

    if (existingError) {
      console.error('Failed to check character_matches:', existingError);
      continue;
    }
    if (existingMatches?.length && !UPDATE_EXISTING) {
      continue;
    }

    const { data: tagStats, error: tagError } = await supabase
      .from('tag_statistics')
      .select('tag_english, score_percentage')
      .eq('user_session_id', session.id);

    if (tagError) {
      console.error('Failed to read tag_statistics:', tagError);
      continue;
    }
    if (!tagStats || tagStats.length === 0) {
      console.warn('No tag_statistics for session:', session.id);
      continue;
    }

    const question25Answer = await getQuestion25Answer(session.id);
    const userScores = computeAdjustedScores(tagStats);
    const sortedCharacters = sortCharactersByMatch(userScores, question25Answer || undefined);

    const matches = sortedCharacters.map((character, index) => {
      let inRangeCount = 0;
      let outOfRangeDiffSum = 0;
      Object.entries(character.tagRanges).forEach(([tag, range]) => {
        const userScore = userScores[tag];
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

      const finalPercentage = Math.round((inRangeCount / 6) * 100);
      return {
        user_session_id: session.id,
        character_id: character.id,
        match_rank: index + 1,
        in_range_count: inRangeCount,
        out_of_range_diff_sum: outOfRangeDiffSum,
        final_percentage: finalPercentage,
        question_25_answer: question25Answer || null
      };
    });

    if (existingMatches?.length) {
      const { error: deleteError } = await supabase
        .from('character_matches')
        .delete()
        .eq('user_session_id', session.id);

      if (deleteError) {
        console.error('Failed to delete existing character_matches:', deleteError);
        continue;
      }
    }

    const { error: insertError } = await supabase
      .from('character_matches')
      .insert(matches);

    if (insertError) {
      console.error('Failed to insert character_matches:', insertError);
      continue;
    }

    const bestMatch = matches.find(m => m.match_rank === 1);
    if (bestMatch) {
      const { error: updateError } = await supabase
        .from('user_sessions')
        .update({
          character_match: bestMatch.character_id,
          questionnaire_completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('id', session.id);

      if (updateError) {
        console.error('Failed to update user_sessions:', updateError);
      }
    }

    console.log(
      `${existingMatches?.length ? 'Updated' : 'Backfilled'} character_matches for session:`,
      session.id
    );
  }
};

await backfill();
