import axios, { isAxiosError } from 'axios';
import { getApiBaseUrl } from '../config/apiBaseUrl';

// 问卷类型定义
export type QuestionnaireType = 'mother' | 'corporate' | 'other' | 'both';
export type QuestionType = 'multiple-choice' | 'text-input' | 'scale-question' | 'multi-select' | 'searchable-dropdown' | 'text-with-unit' | 'email';

// 回答格式定义
export interface QuestionResponse {
  questionnaire_type: QuestionnaireType;
  question_id: number | string; // 唯一ID
  unified_question_id: number; // 统一问题ID
  question_type: QuestionType;
  response_value: string;
}

/**
 * 立即保存intro choice到后端
 * @param choice 用户的选择，yes或no
 * @returns Promise，表示保存操作的结果
 */
export const saveIntroChoice = async (choice: string): Promise<boolean> => {
  try {
    const response = await axios.post(`${getApiBaseUrl()}/intro-choice`, {
      choice: choice
    });
    
    if (response.data.success) {
      console.log(`Successfully saved intro choice '${choice}' to backend`);
      return true;
    } else {
      console.warn('Intro choice saved but server reported an issue:', response.data);
      return false;
    }
  } catch (error) {
    console.error('Error saving intro choice to backend:', error);
    return false;
  }
};

/**
 * 批量保存所有问卷回答到后端
 * @param responses 所有问题的回答数组
 * @param userSessionId 用户会话ID，用于链接到individual user
 * @throws Error with server or network message on failure (so completion flow can show it)
 */
export const saveAllQuestionResponses = async (
  responses: QuestionResponse[],
  userSessionId?: string
): Promise<void> => {
  if (!responses?.length) {
    throw new Error('No answers were prepared to save. Try selecting your last answer again.');
  }

  const requestData: Record<string, unknown> = { responses };
  if (userSessionId) {
    requestData.user_session_id = userSessionId;
  }

  console.log(`Saving ${responses.length} responses to the backend...`);

  try {
    const { data } = await axios.post<{ success?: boolean; error?: string; message?: string }>(
      `${getApiBaseUrl()}/batch-question-responses`,
      requestData
    );
    if (data && data.success === false) {
      throw new Error(
        typeof data.error === 'string' && data.error.trim()
          ? data.error
          : 'Server rejected saving your answers.'
      );
    }
    console.log('Successfully saved all responses to backend');
  } catch (error: unknown) {
    console.error('Error saving responses to backend:', error);
    if (isAxiosError(error)) {
      const body = error.response?.data as { error?: string } | undefined;
      const msg =
        (typeof body?.error === 'string' && body.error.trim()) ||
        (error.response?.status
          ? `Request failed (${error.response.status})`
          : error.message);
      throw new Error(msg || 'Failed to save answers to the server.');
    }
    throw error;
  }
};

/**
 * 保存单个问题回答到后端（用于实时更新）
 */
export const saveQuestionResponse = async (
  response: QuestionResponse,
  userSessionId?: string
): Promise<boolean> => {
  try {
    const requestData: Record<string, unknown> = { ...response };
    if (userSessionId) {
      requestData.user_session_id = userSessionId;
    }
    await axios.post(`${getApiBaseUrl()}/question-response`, requestData);
    return true;
  } catch (error) {
    console.error('Error saving question response to backend:', error);
    return false;
  }
};

/**
 * 准备问卷回答数据
 * 将本地答案转换为后端API所需的格式
 * 如果存在uniqueIdMapping，则使用它将问题ID映射到唯一ID
 * 
 * @param questionnaireType 问卷类型
 * @param questions 问题列表，用于获取问题类型
 * @param answers 用户的回答
 * @param uniqueIdMapping 可选，问题ID到唯一ID的映射
 * @returns 准备好发送到后端的回答数组
 */
type QuestionWithUnified = { id: string; type: QuestionType; unifiedId?: number };

export const prepareQuestionResponses = (
  questionnaireType: QuestionnaireType,
  questions: Array<QuestionWithUnified>,
  answers: Record<string, string>
): QuestionResponse[] => {
  const responses: QuestionResponse[] = [];
  
  for (const [questionId, value] of Object.entries(answers)) {
    // 查找问题以获取其类型（允许 key 与列表 id 不完全一致时按 local index 对齐）
    let question = questions.find(q => q.id === questionId);
    if (!question) {
      const suffix = /^[a-z]+_(\d+)$/i.exec(String(questionId));
      if (suffix) {
        const localIdx = parseInt(suffix[1], 10);
        question = questions.find((q) => {
          const m = /^[a-z]+_(\d+)$/i.exec(q.id);
          return m && parseInt(m[1], 10) === localIdx;
        });
      }
    }
    if (question) {
      let unifiedQuestionId = question.unifiedId;
      if (typeof unifiedQuestionId !== 'number' || Number.isNaN(unifiedQuestionId)) {
        const suffix = /^[a-z]+_(\d+)$/i.exec(String(questionId));
        if (suffix) {
          const localIdx = parseInt(suffix[1], 10);
          const bySuffix = questions.find((q) => {
            const m = /^[a-z]+_(\d+)$/i.exec(q.id);
            return m && parseInt(m[1], 10) === localIdx;
          });
          if (bySuffix && typeof bySuffix.unifiedId === 'number' && !Number.isNaN(bySuffix.unifiedId)) {
            unifiedQuestionId = bySuffix.unifiedId;
          }
        }
      }
      if (typeof unifiedQuestionId !== 'number' || Number.isNaN(unifiedQuestionId)) {
        console.warn(
          'prepareQuestionResponses: skipping answer without unifiedId',
          questionnaireType,
          questionId
        );
        continue;
      }

      responses.push({
        questionnaire_type: questionnaireType,
        question_id: questionId,
        unified_question_id: unifiedQuestionId,
        question_type: question.type,
        response_value: value
      });
    }
  }
  
  return responses;
};

export default {
  saveIntroChoice,
  saveAllQuestionResponses,
  saveQuestionResponse,
  prepareQuestionResponses
}; 
