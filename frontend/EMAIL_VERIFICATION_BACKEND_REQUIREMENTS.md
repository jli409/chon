# Email Verification Backend Implementation Requirements

## Overview
This document outlines the backend implementation requirements for the email verification feature for corporate manager questionnaires.

## Current Status
✅ **Frontend Implementation Complete**
- Question 6 moved to independent "Email Verification" section
- Question type changed from 'text-input' to 'email'
- Email verification UI component created
- Frontend validation and user flow implemented
- Temporary localStorage-based verification for development

❌ **Backend Implementation Required**
The current implementation uses localStorage for demonstration purposes. A production backend is needed for actual email verification.

## Required Backend Endpoints

### 1. Send Verification Email
**Endpoint:** `POST /api/email/send-verification`

**Request Body:**
```json
{
  "email": "user@company.com",
  "language": "en" // or "zh"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification email sent successfully",
  "verificationToken": "unique_token_here"
}
```

**Implementation Requirements:**
- Validate email format
- Generate unique verification token (UUID recommended)
- Store token in database with:
  - Email address
  - Token
  - Creation timestamp
  - Expiration time (recommended: 24 hours)
  - Verification status (pending/verified)
- Send email with verification link:
  - English template: "Click here to verify your email: [link]"
  - Chinese template: "点击此处验证您的邮箱：[link]"
- Verification link format: `https://your-domain.com/personality-test?verify=[token]`
- Return error if email sending fails

### 2. Verify Email Token
**Endpoint:** `GET /api/email/verify/:token`

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "sessionToken": "session_token_for_questionnaire"
}
```

**Implementation Requirements:**
- Validate token exists in database
- Check token hasn't expired (24 hour window recommended)
- Check token hasn't already been used
- Mark email as verified in database
- Generate session token for questionnaire access
- Return session token to frontend for authenticated questionnaire access
- Handle invalid/expired token errors gracefully

### 3. Resend Verification Email
**Endpoint:** `POST /api/email/resend-verification`

**Request Body:**
```json
{
  "email": "user@company.com",
  "language": "en" // or "zh"
}
```

**Response:** Same as Send Verification Email

**Implementation Requirements:**
- Invalidate previous token for this email
- Generate new token
- Send new verification email
- Implement rate limiting (max 3 resends per hour recommended)

### 4. Check Verification Status
**Endpoint:** `GET /api/email/status/:email`

**Response:**
```json
{
  "verified": true,
  "email": "user@company.com"
}
```

**Implementation Requirements:**
- Check if email has been verified
- Return verification status
- Optionally return session token if verified

## Database Schema

### Email Verifications Table
```sql
CREATE TABLE email_verifications (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  verification_token VARCHAR(255) UNIQUE NOT NULL,
  session_token VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP,
  is_verified BOOLEAN DEFAULT FALSE,
  questionnaire_type VARCHAR(50), -- 'corporate' or 'both'
  INDEX idx_email (email),
  INDEX idx_verification_token (verification_token),
  INDEX idx_session_token (session_token)
);
```

## Email Service Requirements

### Email Template (English)
```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Arial', sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { background-color: #F0BDC0; color: white; padding: 15px 30px; 
                  text-decoration: none; border-radius: 5px; display: inline-block; }
    </style>
</head>
<body>
    <div class="container">
        <h2>CHON Email Verification</h2>
        <p>Thank you for participating in the CHON Corporate Manager Questionnaire.</p>
        <p>Please click the button below to verify your professional email address and continue with the questionnaire:</p>
        <p style="text-align: center; margin: 30px 0;">
            <a href="{{verification_link}}" class="button">Verify My Email</a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p>{{verification_link}}</p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't request this verification, please ignore this email.</p>
    </div>
</body>
</html>
```

### Email Template (Chinese)
```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Arial', 'Microsoft YaHei', sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { background-color: #F0BDC0; color: white; padding: 15px 30px; 
                  text-decoration: none; border-radius: 5px; display: inline-block; }
    </style>
</head>
<body>
    <div class="container">
        <h2>CHON 邮箱验证</h2>
        <p>感谢您参与 CHON 企业管理者问卷调查。</p>
        <p>请点击下方按钮验证您的职业邮箱地址并继续问卷：</p>
        <p style="text-align: center; margin: 30px 0;">
            <a href="{{verification_link}}" class="button">验证我的邮箱</a>
        </p>
        <p>或将此链接复制粘贴到您的浏览器：</p>
        <p>{{verification_link}}</p>
        <p>此链接将在24小时后过期。</p>
        <p>如果您没有请求此验证，请忽略此邮件。</p>
    </div>
</body>
</html>
```

## Security Considerations

1. **Token Security:**
   - Use cryptographically secure random tokens (UUID v4 recommended)
   - Tokens should be at least 32 characters long
   - Tokens should expire after 24 hours
   - One-time use only (invalidate after verification)

2. **Rate Limiting:**
   - Limit verification email requests to 3 per hour per email
   - Implement CAPTCHA for repeated requests
   - Log suspicious activity (multiple failed verifications)

3. **Email Validation:**
   - Verify email format on backend
   - Consider implementing domain validation (block disposable email services)
   - Optionally verify corporate email domain (e.g., not @gmail.com, @yahoo.com)

4. **Session Management:**
   - Generate secure session tokens after verification
   - Session tokens should expire after questionnaire completion or 7 days
   - Store session tokens securely (hashed in database)

## Frontend Integration Points

### 1. Verification Link Handler
The frontend already has routing set up. When user clicks verification link:
- URL: `https://your-domain.com/personality-test?verify=[token]`
- Frontend calls `verifyEmailToken(token)` in emailVerification.ts
- Update this function to call backend API instead of localStorage
- On success, redirect to questionnaire demographics section
- On failure, show error message with option to resend

### 2. Session Management
After successful verification:
- Store session token in localStorage or secure cookie
- Include session token in all questionnaire API requests
- Validate session token on backend for each request

### 3. Error Handling
Frontend displays appropriate messages for:
- Invalid email format
- Verification email sending failure
- Token expired
- Token invalid
- Network errors

## Email Service Provider Options

Recommended providers for email delivery:
1. **SendGrid** - Reliable, good documentation
2. **AWS SES** - Cost-effective, integrates with AWS ecosystem
3. **Mailgun** - Good for transactional emails
4. **Postmark** - Fast delivery, good analytics

## Environment Variables Required

```env
# Email Service
EMAIL_SERVICE_API_KEY=your_api_key_here
EMAIL_FROM_ADDRESS=noreply@chon.com
EMAIL_FROM_NAME=CHON

# Frontend URL for verification links
FRONTEND_URL=https://your-domain.com

# Token expiration (in hours)
VERIFICATION_TOKEN_EXPIRY=24

# Database
DATABASE_URL=your_database_connection_string
```

## Testing Checklist

- [ ] Send verification email successfully
- [ ] Verification link works and redirects correctly
- [ ] Token expires after 24 hours
- [ ] Token can only be used once
- [ ] Resend email functionality works
- [ ] Rate limiting prevents spam
- [ ] Email templates render correctly in major email clients
- [ ] Error messages display appropriately
- [ ] Session management works across browser sessions
- [ ] Both English and Chinese email templates work

## Next Steps

1. Set up email service provider account
2. Create email verification database table
3. Implement backend API endpoints
4. Update frontend emailVerification.ts to call real API
5. Test end-to-end flow
6. Deploy to production
7. Monitor email delivery rates and errors

## Support & Contact

For questions about this implementation, please contact the development team.

