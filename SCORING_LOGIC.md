# Questionnaire Scoring System

## Overview
The scoring system calculates personality trait scores based on questionnaire answers and applies a 10% boost from question 25 (the final question).

## How Scoring Works

### 1. **Scale Question Scoring**
- Scale questions use a 5-point scale (1-5)
- The scoring function (`scaleValueToPercentage`) converts:
  - 1 → 20% (0-20% range)
  - 2 → 40% (21-40% range)
  - 3 → 60% (41-60% range)
  - 4 → 80% (61-80% range)
  - 5 → 100% (81-100% range)

### 2. **Tag-Based Scoring**
Questions are tagged with one or more personality traits:
- `selfAwareness` (自我意识)
- `dedication` (奉献精神)
- `socialIntelligence` (社交情商)
- `emotionalRegulation` (情绪调节)
- `objectivity` (客观能力)
- `coreEndurance` (核心耐力)

Each tagged question contributes its score to all its assigned tags.

### 3. **Final Score Calculation**
For each tag:
1. Sum all question scores for that tag
2. Calculate percentage: `(sum of scores / (number of answered questions × 100)) × 100`
3. This gives the percentage score for that trait

**Example:**
- If you answered 5 questions tagged with "dedication"
- Your scores were: 80, 60, 100, 80, 60
- Sum: 380
- Total possible: 500 (5 questions × 100)
- Percentage: (380/500) × 100 = 76%

## Question 25 - 10% Bonus System

### Answer Mapping to Skills
Question 25 asks: *"If you could create or change one thing, what would it be?"*

**Answer A** → +10% to **Dedication** (Prometheus character)
**Answer B** → +10% to **Emotional Regulation** (Wukong character)  
**Answer C** → +10% to **Self-Awareness** (Odin character)
**Answer D** → +10% to **Social Intelligence** (Venus character)
**Answer E** → +10% to **Core Endurance** (Nuwa character)
**Answer F** → +10% to **Objectivity** (Athena character)

### Implementation
- Located in: `frontend/src/utils/characterMatching.ts` - `applyQuestion25Bonus()` function
- Applied in: `frontend/src/pages/Results/Results.tsx` (lines 838-842)
- The bonus adds 10 percentage points to the selected skill (capped at 100%)

## Code Location

### Scoring Functions
**File**: `frontend/src/utils/tagUtils.ts`
```typescript
// Converts scale value to percentage (1-5 → 20-100%)
scaleValueToPercentage(value: string | number): number

// Calculate tag statistics (totals, averages, percentages)
calculateTagStats(currentTagScores, tagQuestionCounts)

// Count questions per tag
countQuestionsPerTag(questions)
```

### Update Scores When Answering
**File**: `frontend/src/pages/PersonalityTest/PersonalityTest.tsx` (lines 3081-3148)
```typescript
const updateTagScores = (questionId, value) => {
  // Gets the question and its tags
  const question = getCurrentQuestions().find(q => q.id === questionId);
  
  // Converts answer to score (for scale questions only)
  if (question.type === 'scale-question') {
    score = scaleValueToPercentage(value);
  }
  
  // Updates score for each tag on the question
  question.tags.forEach(tag => {
    // Saves score to localStorage
    // Updates tagScores state
  });
}
```

### Apply Question 25 Bonus
**File**: `frontend/src/utils/characterMatching.ts` (lines 6-28)
```typescript
export const applyQuestion25Bonus = (userScores, question25Answer) => {
  const bonusScores = { ...userScores };
  
  const answerToTagMap = {
    'A': 'dedication',
    'B': 'emotionalRegulation', 
    'C': 'selfAwareness',
    'D': 'socialIntelligence',
    'E': 'coreEndurance',
    'F': 'objectivity'
  };
  
  const tagToBoost = answerToTagMap[question25Answer];
  if (tagToBoost && bonusScores[tagToBoost] !== undefined) {
    bonusScores[tagToBoost] = Math.min(100, bonusScores[tagToBoost] + 10);
  }
  
  return bonusScores;
};
```

### Apply Bonus in Results
**File**: `frontend/src/pages/Results/Results.tsx` (lines 810-842)
```typescript
// Get question 25 answer from answers
const question25Answer = answers[question25Id]; // e.g., 'mother_33'

// Apply 10% boost to corresponding skill
if (question25Answer) {
  finalScores = applyQuestion25Bonus(userScores, question25Answer);
}
```

## How It Works With Updated Question Lists

The scoring system automatically adapts to the updated question lists because:

1. **Question IDs are prefixed**: Each question has an ID like `mother_33`, `corporate_33`, etc.
2. **getCurrentQuestions()** returns the correct questions for the active questionnaire type
3. **Score calculation uses the actual questions loaded**:
   - Uses `countQuestionsPerTag(questions)` to count tagged questions
   - Calculates percentages based on actual questions answered
4. **Question 25 is always the last question**:
   - Mother: `mother_33`
   - Corporate: `corporate_33`
   - Other: `other_32`
   - Both: `both_44`

## Data Storage

Scores are stored in localStorage:
- `questionScores_<chineseTag>`: Maps question IDs to scores **for each tag separately**
  - Why per-tag? Because **one question can have multiple tags**
  - Example: Question 13 with tags `['objectivity', 'socialIntelligence']` stores:
    - `questionScores_客观能力['mother_13'] = 60`
    - `questionScores_社交情商['mother_13'] = 60`
    - Same question, same score, but stored in BOTH tag mappings!
- `tagScores`: Array of scores per tag
- `tagStats`: Calculated statistics (totals, averages, percentages)
- `currentAnswers`: All user answers with question IDs
- `selectedQuestionnaireType`: Questionnaire type taken

### Why Per-Tag Storage?

**The problem**: A single question can contribute to multiple personality traits.
- Question 13: `tags: ['objectivity', 'socialIntelligence']`
- Your answer of 60% needs to contribute to BOTH tags!

**The solution**: Store the same question's score in each tag it belongs to.
- Without this: We'd have to filter all questions each time to find which ones belong to each tag
- With this: Each tag has its own complete list of contributing question scores

## Testing
To verify scoring works:
1. Complete a questionnaire
2. Check browser console for:
   - "标签分数已更新并保存" messages
   - "==== 标签得分统计 ====" table
3. On Results page, check console for:
   - "Question 25 ID: ..." and "Answer: ..."
   - Verify 10% boost is applied to the correct skill

