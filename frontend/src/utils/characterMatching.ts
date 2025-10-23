// Character matching utility

/**
 * Find the best matching character based on:
 * 1. Maximum number of skills in range
 * 2. For out-of-range skills, minimum sum of differences
 */
export const findBestMatchCharacter = <T extends { tagRanges: Record<string, [number, number]> }>(
  userScores: Record<string, number>,
  characters: T[]
): T => {
  let bestMatch = characters[0];
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
    
    // Update best match based on:
    // 1. More skills in range (higher priority)
    // 2. Lower sum of out-of-range differences (tiebreaker)
    if (inRangeCount > maxInRange || 
        (inRangeCount === maxInRange && outOfRangeDiffSum < minOutOfRangeDiff)) {
      maxInRange = inRangeCount;
      minOutOfRangeDiff = outOfRangeDiffSum;
      bestMatch = character;
    }
  });

  return bestMatch;
};

/**
 * Sort all characters by best match:
 * 1. First by number of skills in range (descending)
 * 2. Then by sum of out-of-range differences (ascending)
 */
export const sortCharactersByMatch = <T extends { tagRanges: Record<string, [number, number]> }>(
  userScores: Record<string, number>,
  characters: T[]
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
  return charactersWithScores
    .sort((a, b) => {
      if (a.inRangeCount !== b.inRangeCount) {
        return b.inRangeCount - a.inRangeCount; // More in-range is better
      }
      return a.outOfRangeDiffSum - b.outOfRangeDiffSum; // Lower difference is better
    })
    .map(item => item.character);
};

