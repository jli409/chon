// Email Verification Service
// This service handles email verification for corporate managers

export interface EmailVerificationResponse {
  success: boolean;
  message: string;
  verificationToken?: string;
}

/**
 * Send verification email to the user
 * @param email - User's professional email address
 * @returns Promise with verification response
 * 
 * NOTE: This is a frontend placeholder. In production, this should call a backend API endpoint.
 * Backend implementation needed:
 * 1. POST /api/email/send-verification
 * 2. Generate unique verification token
 * 3. Send email with verification link
 * 4. Store token in database with expiration
 */
export const sendVerificationEmail = async (email: string): Promise<EmailVerificationResponse> => {
  try {
    // TODO: Replace with actual API call to backend
    // Example:
    // const response = await axios.post('/api/email/send-verification', { email });
    // return response.data;
    
    // Temporary placeholder - simulate API call
    console.log('Email verification would be sent to:', email);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For development: Store email in localStorage and simulate success
    localStorage.setItem('pendingVerificationEmail', email);
    localStorage.setItem('verificationToken', `temp_token_${Date.now()}`);
    
    return {
      success: true,
      message: 'Verification email sent successfully. Please check your inbox.',
      verificationToken: `temp_token_${Date.now()}`
    };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return {
      success: false,
      message: 'Failed to send verification email. Please try again.'
    };
  }
};

/**
 * Verify email token
 * @param token - Verification token from email link
 * @returns Promise with verification status
 * 
 * NOTE: This is a frontend placeholder. In production, this should call a backend API endpoint.
 * Backend implementation needed:
 * 1. GET /api/email/verify/:token
 * 2. Validate token exists and hasn't expired
 * 3. Mark email as verified in database
 * 4. Return user session/authentication token
 */
export const verifyEmailToken = async (token: string): Promise<EmailVerificationResponse> => {
  try {
    // TODO: Replace with actual API call to backend
    // Example:
    // const response = await axios.get(`/api/email/verify/${token}`);
    // return response.data;
    
    console.log('Verifying token:', token);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // For development: Check if token matches stored token
    const storedToken = localStorage.getItem('verificationToken');
    
    if (storedToken === token) {
      localStorage.setItem('emailVerified', 'true');
      return {
        success: true,
        message: 'Email verified successfully! You can now continue with the questionnaire.'
      };
    } else {
      return {
        success: false,
        message: 'Invalid or expired verification link.'
      };
    }
  } catch (error) {
    console.error('Error verifying email:', error);
    return {
      success: false,
      message: 'Failed to verify email. Please try again.'
    };
  }
};

/**
 * Check if email is verified
 * @returns boolean indicating verification status
 */
export const isEmailVerified = (): boolean => {
  // TODO: Replace with actual session check from backend
  return localStorage.getItem('emailVerified') === 'true';
};

/**
 * Resend verification email
 * @param email - User's professional email address
 * @returns Promise with verification response
 */
export const resendVerificationEmail = async (email: string): Promise<EmailVerificationResponse> => {
  return sendVerificationEmail(email);
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

