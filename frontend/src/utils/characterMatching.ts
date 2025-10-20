// Character matching utility

/**
 * Find the best matching character using sum of squares difference
 * Compares user scores to the midpoint of each character's tag ranges
 * Returns the character with the lowest sum of squared differences
 */
export const findBestMatchCharacter = <T extends { tagRanges: Record<string, [number, number]> }>(
  userScores: Record<string, number>,
  characters: T[]
): T => {
  let bestMatch = characters[0];
  let lowestDifference = Infinity;

  characters.forEach(character => {
    let sumOfSquares = 0;
    
    Object.entries(character.tagRanges).forEach(([tag, range]) => {
      const userScore = userScores[tag];
      if (userScore !== undefined) {
        // Calculate minimum distance to either lower or upper bound
        const distanceToLower = Math.abs(userScore - range[0]);
        const distanceToUpper = Math.abs(userScore - range[1]);
        const minDistance = Math.min(distanceToLower, distanceToUpper);
        
        // Square the minimum distance
        sumOfSquares += minDistance * minDistance;
      }
    });
    
    // Update best match if this character has lower sum of squares
    if (sumOfSquares < lowestDifference) {
      lowestDifference = sumOfSquares;
      bestMatch = character;
    }
  });

  return bestMatch;
};

/**
 * Sort all characters by best match (lowest sum of squares first)
 */
export const sortCharactersByMatch = <T extends { tagRanges: Record<string, [number, number]> }>(
  userScores: Record<string, number>,
  characters: T[]
): T[] => {
  const charactersWithScores = characters.map(character => {
    let sumOfSquares = 0;
    
    Object.entries(character.tagRanges).forEach(([tag, range]) => {
      const userScore = userScores[tag];
      if (userScore !== undefined) {
        // Calculate minimum distance to either lower or upper bound
        const distanceToLower = Math.abs(userScore - range[0]);
        const distanceToUpper = Math.abs(userScore - range[1]);
        const minDistance = Math.min(distanceToLower, distanceToUpper);
        
        // Square the minimum distance
        sumOfSquares += minDistance * minDistance;
      }
    });
    
    return {
      character,
      sumOfSquares
    };
  });

  // Sort by sum of squares (lowest first = best match)
  return charactersWithScores
    .sort((a, b) => a.sumOfSquares - b.sumOfSquares)
    .map(item => item.character);
};

