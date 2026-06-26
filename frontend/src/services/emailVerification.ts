// Email verification for account creation (after questionnaire).
// **Send:** Supabase Auth ``signInWithOtp`` (magic link). Postmark via CHON API is optional fallback.
// **Complete:** Supabase link → ``/auth/callback`` (or ``/login``) → session + ``POST /auth/callback`` sync.
// Postmark fallback: ``GET /email/verify/:token>``.

import axios from 'axios';
import { supabase } from '../lib/supabaseClient.ts';
import { getApiBaseUrl } from '../config/apiBaseUrl';
import { parseChonSessionIdFromSearch } from '../utils/chonSessionUrl.ts';

const VALID_QT = new Set(['mother', 'corporate', 'other', 'both']);

export interface EmailVerificationResponse {
  success: boolean;
  message: string;
  verificationToken?: string;
  sessionToken?: string;
  email?: string;
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; message?: string } | undefined;
    const fromBody =
      (typeof data?.error === 'string' && data.error.trim()) ||
      (typeof data?.message === 'string' && data.message.trim());
    if (fromBody) {
      return fromBody;
    }
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      return 'Could not reach the API. Check that the site can reach the backend (URL / CORS / VPN).';
    }
    if (error.response?.status === 503) {
      return 'Email service unavailable (server may be missing POSTMARK_SERVER_TOKEN or Postmark rejected the send).';
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

/**
 * Send a Supabase Auth magic-link email (primary account-verification path).
 * Redirect lands on ``/auth/callback`` with ``sid`` so CHON session is restored before DB sync.
 */
export const sendSupabaseOtpVerificationLink = async (
  email: string,
  userSessionId: string
): Promise<EmailVerificationResponse> => {
  const redirectUrl = `${window.location.origin}/auth/callback?sid=${encodeURIComponent(userSessionId)}&mode=register`;
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: redirectUrl,
      shouldCreateUser: true,
    },
  });
  if (error) {
    return {
      success: false,
      message: error.message || 'Supabase could not send the verification email.',
    };
  }
  return {
    success: true,
    message: 'Please check inbox for link to continue creating your account.',
  };
};

/**
 * Send verification via CHON API + Postmark (preferred when ``POSTMARK_SERVER_TOKEN`` is configured).
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
    
    const response = await axios.post(`${getApiBaseUrl()}/email/send-verification`, requestData);
    
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
 * After Supabase magic-link session exists, sync verification into CHON DB
 * (``email_verifications`` + ``user_sessions.email_verified``) via POST ``/auth/callback``.
 */
export const syncEmailVerificationWithChonBackend = async (): Promise<boolean> => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const email = session?.user?.email?.trim();
    const authUserId = session?.user?.id;
    if (!email || !authUserId) {
      return false;
    }

    const rawQt =
      localStorage.getItem('userSessionQuestionnaireType') ||
      localStorage.getItem('selectedQuestionnaireType') ||
      localStorage.getItem('activeQuestionnaire');
    const questionnaire_type =
      rawQt && VALID_QT.has(rawQt) ? rawQt : undefined;

    const userSessionId =
      localStorage.getItem('userSessionId')?.trim() ||
      parseChonSessionIdFromSearch(new URLSearchParams(window.location.search)) ||
      undefined;

    if (userSessionId && !localStorage.getItem('userSessionId')) {
      localStorage.setItem('userSessionId', userSessionId);
    }

    const response = await axios.post<{
      success?: boolean;
      userSessionId?: string;
      user_session_id?: string;
    }>(
      `${getApiBaseUrl()}/auth/callback`,
      {
        email,
        auth_user_id: authUserId,
        ...(questionnaire_type ? { questionnaire_type } : {}),
        ...(userSessionId ? { user_session_id: userSessionId } : {}),
      },
      { validateStatus: () => true }
    );

    const data = response.data;
    if (response.status < 200 || response.status >= 300 || data?.success !== true) {
      console.error('auth/callback failed:', response.status, data);
      return false;
    }

    const sid =
      (typeof data?.userSessionId === 'string' && data.userSessionId.trim()) ||
      (typeof data?.user_session_id === 'string' && data.user_session_id.trim()) ||
      '';
    if (sid) {
      localStorage.setItem('userSessionId', sid);
    }

    localStorage.setItem('emailVerified', 'true');
    const normalizedEmail = email.trim().toLowerCase();
    localStorage.setItem('verifiedEmail', normalizedEmail);
    localStorage.setItem('userSessionEmail', normalizedEmail);
    return true;
  } catch (error: unknown) {
    console.error('syncEmailVerificationWithChonBackend failed:', error);
    return false;
  }
};

/** Call GET /email/verify/:token (Postmark magic-link flow). */
export const verifyEmailToken = async (token: string): Promise<EmailVerificationResponse> => {
  try {
    let verifyUrl = `${getApiBaseUrl()}/email/verify/${encodeURIComponent(token)}`;
    try {
      const sid = parseChonSessionIdFromSearch(new URLSearchParams(window.location.search));
      if (sid) {
        verifyUrl += `?sid=${encodeURIComponent(sid)}`;
      }
    } catch {
      /* ignore */
    }
    const response = await axios.get(verifyUrl);
    
    if (response.data.success) {
      console.log('Email verified successfully');
      
      // Store verification status and session token
      localStorage.setItem('emailVerified', 'true');
      if (response.data.sessionToken) {
        const sid = response.data.sessionToken as string;
        localStorage.setItem('sessionToken', sid);
        // Backend session_token is user_sessions.id — keep userSessionId in sync for API calls.
        localStorage.setItem('userSessionId', sid);
      }
      if (response.data.email) {
        localStorage.setItem('verifiedEmail', response.data.email);
      }
      
      return {
        success: true,
        message: response.data.message || 'Email verified successfully! You can now create your account.',
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
export const resendVerificationEmail = async (
  email: string,
  language: string = 'en',
  questionnaireType: string = 'mother',
  userSessionId?: string
): Promise<EmailVerificationResponse> => {
  try {
    const body: Record<string, unknown> = {
      email,
      language,
      questionnaire_type: questionnaireType
    };
    if (userSessionId) {
      body.user_session_id = userSessionId;
    }
    const response = await axios.post(`${getApiBaseUrl()}/email/resend-verification`, body);
    
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
