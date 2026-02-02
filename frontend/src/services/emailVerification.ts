// Email Verification Service
// This service handles email verification for corporate managers

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export interface EmailVerificationResponse {
  success: boolean;
  message: string;
  verificationToken?: string;
  sessionToken?: string;
  email?: string;
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;
    if (typeof message === 'string') {
      return message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

/**
 * Send verification email to the user
 * @param email - User's professional email address
 * @param language - Language preference ('en' or 'zh')
 * @returns Promise with verification response
 */
export const sendVerificationEmail = async (email: string, language: string = 'en', questionnaireType: string = 'mother', userSessionId?: string): Promise<EmailVerificationResponse> => {
  try {
    const requestData: Record<string, unknown> = {
      email,
      language,
      questionnaire_type: questionnaireType
    };
    
    if (userSessionId) {
      requestData.user_session_id = userSessionId;
    }
    
    const response = await axios.post(`${API_URL}/email/send-verification`, requestData);
    
    if (response.data.success) {
      console.log('Verification email sent successfully');
      
      // Store session info in localStorage
      localStorage.setItem('pendingVerificationEmail', email);
      if (response.data.verificationToken) {
        localStorage.setItem('verificationToken', response.data.verificationToken);
      }
      
      return {
        success: true,
        message: response.data.message || 'Verification email sent successfully. Please check your inbox.',
        verificationToken: response.data.verificationToken
      };
    }
    
    return {
      success: false,
      message: response.data.message || 'Failed to send verification email. Please try again.'
    };
  } catch (error: unknown) {
    console.error('Error sending verification email:', error);
    return {
      success: false,
      message: getErrorMessage(error, 'Failed to send verification email. Please try again.')
    };
  }
};

/**
 * Verify email token
 * @param token - Verification token from email link
 * @returns Promise with verification status
 */
export const verifyEmailToken = async (token: string): Promise<EmailVerificationResponse> => {
  try {
    const response = await axios.get(`${API_URL}/email/verify/${token}`);
    
    if (response.data.success) {
      console.log('Email verified successfully');
      
      // Store verification status and session token
      localStorage.setItem('emailVerified', 'true');
      if (response.data.sessionToken) {
        localStorage.setItem('sessionToken', response.data.sessionToken);
      }
      if (response.data.email) {
        localStorage.setItem('verifiedEmail', response.data.email);
      }
      
      return {
        success: true,
        message: response.data.message || 'Email verified successfully! You can now continue with the questionnaire.',
        sessionToken: response.data.sessionToken,
        email: response.data.email
      };
    }
    
    return {
      success: false,
      message: response.data.message || 'Failed to verify email.'
    };
  } catch (error: unknown) {
    console.error('Error verifying email:', error);
    return {
      success: false,
      message: getErrorMessage(error, 'Failed to verify email. Please try again.')
    };
  }
};

/**
 * Check if email is verified
 * @returns boolean indicating verification status
 */
export const isEmailVerified = (): boolean => {
  return localStorage.getItem('emailVerified') === 'true';
};

/**
 * Resend verification email
 * @param email - User's professional email address
 * @param language - Language preference ('en' or 'zh')
 * @returns Promise with verification response
 */
export const resendVerificationEmail = async (email: string, language: string = 'en', questionnaireType: string = 'mother'): Promise<EmailVerificationResponse> => {
  try {
    const response = await axios.post(`${API_URL}/email/resend-verification`, {
      email,
      language,
      questionnaire_type: questionnaireType
    });
    
    if (response.data.success) {
      return {
        success: true,
        message: response.data.message || 'Verification email resent successfully.'
      };
    }
    
    return {
      success: false,
      message: response.data.message || 'Failed to resend verification email.'
    };
  } catch (error: unknown) {
    console.error('Error resending verification email:', error);
    return {
      success: false,
      message: getErrorMessage(error, 'Failed to resend verification email. Please try again.')
    };
  }
};

/**
 * Validate email format
 * @param email - Email address to validate
 * @returns boolean indicating if email is valid
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

