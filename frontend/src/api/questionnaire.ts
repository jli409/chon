import axios from 'axios';

// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// 问卷类型定义
export type QuestionnaireType = 'mother' | 'corporate' | 'other' | 'both';
export type QuestionType = 'multiple-choice' | 'text-input' | 'scale-question' | 'multi-select' | 'searchable-dropdown' | 'text-with-unit' | 'email';

// 回答格式定义
export interface QuestionResponse {
  questionnaire_type: QuestionnaireType;
  question_id: number | string; // 唯一ID
  original_question_id: number; // 原始问题ID
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
    const response = await axios.post(`${API_URL}/intro-choice`, {
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
 * @returns Promise，表示保存操作的结果
 */
export const saveAllQuestionResponses = async (responses: QuestionResponse[], userSessionId?: string): Promise<boolean> => {
  if (!responses || responses.length === 0) {
    console.warn('No responses to save');
    return false;
  }

  try {
    console.log(`Saving ${responses.length} responses to the backend...`);
    
    // 构建请求数据
    const requestData: Record<string, unknown> = {
      responses
    };
    
    // 添加user_session_id如果提供
    if (userSessionId) {
      requestData.user_session_id = userSessionId;
      console.log(`Linking responses to user session: ${userSessionId}`);
    }
    
    // 使用批量API一次保存所有回答
    await axios.post(`${API_URL}/batch-question-responses`, requestData);
    
    console.log('Successfully saved all responses to backend');
    return true;
  } catch (error) {
    console.error('Error saving responses to backend:', error);
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
export const prepareQuestionResponses = (
  questionnaireType: QuestionnaireType,
  questions: Array<{id: string, type: QuestionType}>,
  answers: Record<string, string>
): QuestionResponse[] => {
  const responses: QuestionResponse[] = [];
  
  for (const [questionId, value] of Object.entries(answers)) {
    // 查找问题以获取其类型
    const question = questions.find(q => q.id === questionId);
    if (question) {
      // 从问题ID中提取数字部分作为原始问题ID
      const originalQuestionId = parseInt(questionId.split('_')[1]) || 0;
      
      responses.push({
        questionnaire_type: questionnaireType,
        question_id: questionId,
        original_question_id: originalQuestionId,
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
  prepareQuestionResponses
}; 