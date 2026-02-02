import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export interface UserSession {
  user_session_id: string;
  session_token: string;
}

export interface TagScore {
  tag_english: string;
  unified_question_id: number;
  score: number;
}

export interface TagStatistics {
  tag_english: string;
  user_score: number;
  total_possible_score: number;
  score_percentage: number;
  answered_questions: number;
  question_25_bonus_applied?: boolean;
  question_25_bonus_tag?: string;
}

export interface CharacterMatch {
  character_id: string;
  match_rank: number;
  in_range_count?: number;
  out_of_range_diff_sum?: number;
  final_percentage: number;
  question_25_answer?: string;
}

/**
 * Create a new user session
 */
export const createUserSession = async (
  introChoice?: string,
  email?: string,
  questionnaireType?: string,
  corporateRole?: string
): Promise<UserSession> => {
  try {
    const response = await axios.post(`${API_URL}/user-sessions`, {
      intro_choice: introChoice,
      email,
      questionnaire_type: questionnaireType,
      corporate_role: corporateRole
    });
    
    if (response.data.success) {
      console.log('User session created:', response.data.user_session_id);
      return {
        user_session_id: response.data.user_session_id,
        session_token: response.data.session_token
      };
    }
    
    throw new Error('Failed to create user session');
  } catch (error) {
    console.error('Error creating user session:', error);
    throw error;
  }
};

/**
 * Save tag scores for a user session
 */
export const saveTagScores = async (
  userSessionId: string,
  tagScores: TagScore[]
): Promise<boolean> => {
  try {
    const response = await axios.post(`${API_URL}/tag-scores`, {
      user_session_id: userSessionId,
      tag_scores: tagScores
    });
    
    console.log('Tag scores saved:', response.data);
    return response.data.success === true;
  } catch (error) {
    console.error('Error saving tag scores:', error);
    return false;
  }
};

/**
 * Save tag statistics for a user session
 */
export const saveTagStatistics = async (
  userSessionId: string,
  statistics: TagStatistics[]
): Promise<boolean> => {
  try {
    const response = await axios.post(`${API_URL}/tag-statistics`, {
      user_session_id: userSessionId,
      statistics: statistics
    });
    
    console.log('Tag statistics saved:', response.data);
    return response.data.success === true;
  } catch (error) {
    console.error('Error saving tag statistics:', error);
    return false;
  }
};

/**
 * Save character matches for a user session
 */
export const saveCharacterMatches = async (
  userSessionId: string,
  matches: CharacterMatch[]
): Promise<string | null> => {
  try {
    const response = await axios.post(`${API_URL}/character-matches`, {
      user_session_id: userSessionId,
      matches: matches
    });
    
    console.log('Character matches saved:', response.data);
    return response.data.best_match || null;
  } catch (error) {
    console.error('Error saving character matches:', error);
    return null;
  }
};

/**
 * Get user session data
 */
export const getUserSession = async (sessionId: string): Promise<Record<string, unknown> | null> => {
  try {
    const response = await axios.get(`${API_URL}/user-sessions/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting user session:', error);
    return null;
  }
};

export default {
  createUserSession,
  saveTagScores,
  saveTagStatistics,
  saveCharacterMatches,
  getUserSession
};

