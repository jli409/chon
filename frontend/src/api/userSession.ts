import axios, { isAxiosError } from 'axios';
import { getApiBaseUrl } from '../config/apiBaseUrl';

const axiosErrorMessage = (error: unknown, fallback: string): string => {
  if (isAxiosError(error)) {
    const body = error.response?.data as { error?: string } | undefined;
    if (typeof body?.error === 'string' && body.error.trim()) {
      return body.error.trim();
    }
    if (error.response?.status) {
      return `${fallback} (HTTP ${error.response.status})`;
    }
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

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
 * Persist email on the intro-created session (verification completes via email link only).
 */
export const patchUserSessionEmail = async (
  userSessionId: string,
  email: string
): Promise<boolean> => {
  return patchUserSession(userSessionId, { email });
};

export type PatchUserSessionPayload = {
  email?: string;
  questionnaire_type?: string;
  corporate_role?: string | null;
};

/**
 * Partially update a user session (email, questionnaire_type from identity, corporate_role).
 */
export const patchUserSession = async (
  userSessionId: string,
  payload: PatchUserSessionPayload
): Promise<boolean> => {
  try {
    const response = await axios.patch(
      `${getApiBaseUrl()}/user-sessions/${encodeURIComponent(userSessionId)}`,
      payload
    );
    return response.data?.success === true;
  } catch (error) {
    console.error('Error patching user session:', error);
    return false;
  }
};

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
    const response = await axios.post(`${getApiBaseUrl()}/user-sessions`, {
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
): Promise<void> => {
  try {
    const response = await axios.post(`${getApiBaseUrl()}/tag-scores`, {
      user_session_id: userSessionId,
      tag_scores: tagScores
    });

    console.log('Tag scores saved:', response.data);
    if (response.data?.success !== true) {
      const msg =
        typeof response.data?.error === 'string' ? response.data.error : 'Tag scores were not accepted.';
      throw new Error(msg);
    }
  } catch (error: unknown) {
    console.error('Error saving tag scores:', error);
    if (isAxiosError(error)) {
      throw new Error(axiosErrorMessage(error, 'Could not save tag scores.'));
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
};

/**
 * Save tag statistics for a user session
 */
export const saveTagStatistics = async (
  userSessionId: string,
  statistics: TagStatistics[]
): Promise<void> => {
  try {
    const response = await axios.post(`${getApiBaseUrl()}/tag-statistics`, {
      user_session_id: userSessionId,
      statistics: statistics
    });

    console.log('Tag statistics saved:', response.data);
    if (response.data?.success !== true) {
      const msg =
        typeof response.data?.error === 'string' ? response.data.error : 'Tag statistics were not accepted.';
      throw new Error(msg);
    }
  } catch (error: unknown) {
    console.error('Error saving tag statistics:', error);
    if (isAxiosError(error)) {
      throw new Error(axiosErrorMessage(error, 'Could not save tag statistics.'));
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
};

/**
 * Save character matches for a user session
 */
export type SaveCharacterMatchesResult = {
  success: boolean;
  bestMatch: string | null;
};

export const saveCharacterMatches = async (
  userSessionId: string,
  matches: CharacterMatch[]
): Promise<SaveCharacterMatchesResult> => {
  try {
    const response = await axios.post(`${getApiBaseUrl()}/character-matches`, {
      user_session_id: userSessionId,
      matches: matches
    });
    if (response.data?.success) {
      console.log('Character matches saved:', response.data);
      return {
        success: true,
        bestMatch: (response.data.best_match as string | undefined) ?? null
      };
    }
    const msg =
      typeof response.data?.error === 'string' ? response.data.error : 'Character matches were not accepted.';
    console.error('Character matches save rejected by API:', response.data);
    throw new Error(msg);
  } catch (error: unknown) {
    console.error('Error saving character matches:', error);
    if (isAxiosError(error)) {
      throw new Error(axiosErrorMessage(error, 'Could not save character matches.'));
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
};

/**
 * Get user session data
 */
export const getUserSession = async (sessionId: string): Promise<Record<string, unknown> | null> => {
  try {
    const response = await axios.get(`${getApiBaseUrl()}/user-sessions/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting user session:', error);
    return null;
  }
};

/**
 * Load saved MC/text answers from the backend (per-session rows on question_responses).
 */
export const fetchSavedQuestionnaireAnswers = async (
  userSessionId: string
): Promise<{ questionnaireType: string; answers: Record<string, string> } | null> => {
  try {
    const response = await axios.get(
      `${getApiBaseUrl()}/user-sessions/${encodeURIComponent(userSessionId)}/saved-questionnaire-answers`
    );
    if (response.data?.success && response.data.answers) {
      return {
        questionnaireType: String(response.data.questionnaire_type || 'mother'),
        answers: response.data.answers as Record<string, string>,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching saved questionnaire answers:', error);
    return null;
  }
};

export default {
  createUserSession,
  patchUserSessionEmail,
  patchUserSession,
  saveTagScores,
  saveTagStatistics,
  saveCharacterMatches,
  getUserSession,
  fetchSavedQuestionnaireAnswers,
};

