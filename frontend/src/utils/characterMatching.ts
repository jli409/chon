// Character matching utility

/**
 * Apply question 25 bonus to tag scores (adds 10% to specific tag)
 */
export const applyQuestion25Bonus = (
  userScores: Record<string, number>,
  question25Answer: string
): Record<string, number> => {
  const bonusScores = { ...userScores };
  
  // Map question 25 answers to tags that get 10% bonus
  const answerToTagMap: Record<string, string> = {
    'A': 'dedication',          // Prometheus
    'B': 'emotionalRegulation', // Wukong
    'C': 'selfAwareness',       // Odin
    'D': 'socialIntelligence',  // Venus
    'E': 'coreEndurance',       // Nuwa
    'F': 'objectivity'          // Athena
  };
  
  const tagToBoost = answerToTagMap[question25Answer];
  if (tagToBoost && bonusScores[tagToBoost] !== undefined) {
    bonusScores[tagToBoost] = Math.min(100, bonusScores[tagToBoost] + 10);
  }
  
  return bonusScores;
};

/**
 * Find the best matching character based on:
 * 1. Maximum number of skills in range
 * 2. For out-of-range skills, minimum sum of differences
 * 3. Apply question 25 tie-breaking if provided
 */
export const findBestMatchCharacter = <T extends { id: string; tagRanges: Record<string, [number, number]> }>(
  userScores: Record<string, number>,
  characters: T[],
  question25Answer?: string
): T => {
  let bestMatches: T[] = [];
  let maxInRange = -1;
  let minOutOfRangeDiff = Infinity;

  characters.forEach(character => {
    let inRangeCount = 0;
    let outOfRangeDiffSum = 0;
    
    Object.entries(character.tagRanges).forEach(([tag, range]) => {
      const userScore = userScores[tag];
      if (userScore !== undefined) {
        // Check if score is in range
        if (userScore >= range[0] && userScore <= range[1]) {
          inRangeCount++;
        } else {
          // Calculate difference for out-of-range score
          if (userScore < range[0]) {
            outOfRangeDiffSum += range[0] - userScore;
          } else {
            outOfRangeDiffSum += userScore - range[1];
          }
        }
      }
    });
    
    // Update best matches based on:
    // 1. More skills in range (higher priority)
    // 2. Lower sum of out-of-range differences (tiebreaker)
    if (inRangeCount > maxInRange || 
        (inRangeCount === maxInRange && outOfRangeDiffSum < minOutOfRangeDiff)) {
      maxInRange = inRangeCount;
      minOutOfRangeDiff = outOfRangeDiffSum;
      bestMatches = [character];
    } else if (inRangeCount === maxInRange && outOfRangeDiffSum === minOutOfRangeDiff) {
      // Tie - add to bestMatches
      bestMatches.push(character);
    }
  });

  // If there's a tie and question 25 answer is provided, use it to break the tie
  if (bestMatches.length > 1 && question25Answer) {
    const answerToCharacterMap: Record<string, string> = {
      'A': 'prometheus',
      'B': 'wukong',
      'C': 'odin',
      'D': 'venus',
      'E': 'nuwa',
      'F': 'athena'
    };
    
    const preferredCharacterId = answerToCharacterMap[question25Answer];
    const preferredCharacter = bestMatches.find(c => c.id.toLowerCase() === preferredCharacterId);
    
    if (preferredCharacter) {
      return preferredCharacter;
    }
  }

  return bestMatches[0];
};

/**
 * Sort all characters by best match:
 * 1. First by number of skills in range (descending)
 * 2. Then by sum of out-of-range differences (ascending)
 * 3. Apply question 25 tie-breaking if provided
 */
export const sortCharactersByMatch = <T extends { id: string; tagRanges: Record<string, [number, number]> }>(
  userScores: Record<string, number>,
  characters: T[],
  question25Answer?: string
): T[] => {
  const charactersWithScores = characters.map(character => {
    let inRangeCount = 0;
    let outOfRangeDiffSum = 0;
    
    Object.entries(character.tagRanges).forEach(([tag, range]) => {
      const userScore = userScores[tag];
      if (userScore !== undefined) {
        // Check if score is in range
        if (userScore >= range[0] && userScore <= range[1]) {
          inRangeCount++;
        } else {
          // Calculate difference for out-of-range score
          if (userScore < range[0]) {
            outOfRangeDiffSum += range[0] - userScore;
          } else {
            outOfRangeDiffSum += userScore - range[1];
          }
        }
      }
    });
    
    return {
      character,
      inRangeCount,
      outOfRangeDiffSum
    };
  });

  // Sort by in-range count (descending), then by out-of-range diff sum (ascending)
  const sorted = charactersWithScores.sort((a, b) => {
    if (a.inRangeCount !== b.inRangeCount) {
      return b.inRangeCount - a.inRangeCount; // More in-range is better
    }
    if (a.outOfRangeDiffSum !== b.outOfRangeDiffSum) {
      return a.outOfRangeDiffSum - b.outOfRangeDiffSum; // Lower difference is better
    }
    
    // Tie-breaking with question 25 answer
    if (question25Answer) {
      const answerToCharacterMap: Record<string, string> = {
        'A': 'prometheus',
        'B': 'wukong',
        'C': 'odin',
        'D': 'venus',
        'E': 'nuwa',
        'F': 'athena'
      };
      
      const preferredCharacterId = answerToCharacterMap[question25Answer];
      if (a.character.id.toLowerCase() === preferredCharacterId) return -1;
      if (b.character.id.toLowerCase() === preferredCharacterId) return 1;
    }
    
    return 0;
  });
  
  return sorted.map(item => item.character);
};

