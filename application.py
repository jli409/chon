import os
import uuid
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from werkzeug.security import generate_password_hash

# Load environment variables
load_dotenv()

application = Flask(__name__)
# Configure CORS for web + API domains
CORS(
    application,
    origins=["https://www.chonlife.com", "https://app.chonlife.com"],
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
)

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    print("WARNING: SUPABASE_URL or SUPABASE_KEY not set. Database functionality will be limited.")
    supabase = None
else:
    try:
        supabase = create_client(supabase_url, supabase_key)
        print("Successfully connected to Supabase")
    except Exception as e:
        print(f"ERROR: Failed to connect to Supabase: {e}")
        supabase = None

# Initialize SendGrid (optional, can work without it)
sendgrid_api_key = os.getenv("SENDGRID_API_KEY")
sendgrid_client = SendGridAPIClient(sendgrid_api_key) if sendgrid_api_key else None

# Email configuration
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://www.chonlife.com")
EMAIL_FROM = os.getenv("EMAIL_FROM", "contact@chon.life")
EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "CHON")

# Decorator to check if database is available
def require_database(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if supabase is None:
            return jsonify({
                "error": "Database connection not available. Please check server configuration."
            }), 503
        return f(*args, **kwargs)
    return decorated_function

def ensure_supabase_ok(result, context: str):
    error = getattr(result, 'error', None)
    if error:
        raise Exception(f"{context}: {error}")
    return result

@application.route('/')
def index():
    return jsonify({"message": "CHON Personality Test API"})

@application.route('/health')
def health():
    """Health check endpoint for AWS Elastic Beanstalk"""
    health_status = {
        "status": "healthy",
        "service": "CHON API",
        "supabase": "connected" if supabase else "not configured",
        "sendgrid": "configured" if sendgrid_client else "not configured"
    }
    
    # Return 200 even if some services are not configured
    # The app can still serve requests
    return jsonify(health_status), 200

@application.route('/healthz')
def api_health():
    return jsonify(status="ok"), 200

@application.route('/intro-choice', methods=['POST'])
@require_database
def update_intro_choice():
    """
    Update the count for the intro question (yes/no choice)
    Expects JSON: {"choice": "yes"} or {"choice": "no"}
    """
    data = request.get_json()
    choice = data.get('choice')
    
    if choice not in ['yes', 'no']:
        return jsonify({'error': 'Invalid choice. Must be "yes" or "no"'}), 400
    
    try:
        # 使用SQL更新计数，确保原子性
        supabase.table('intro_choices').update({"count": supabase.table('intro_choices').select('count').eq('choice', choice).execute().data[0]['count'] + 1}).eq('choice', choice).execute()
        
        return jsonify({'success': True, 'message': f'Successfully incremented count for {choice}'})
    
    except Exception as e:
        print(f"Error updating intro choice: {e}")
        return jsonify({'error': str(e)}), 500

@application.route('/intro-stats', methods=['GET'])
@require_database
def get_intro_stats():
    """
    获取intro choices统计数据
    返回yes和no的计数以及yes的百分比
    """
    try:
        # 从Supabase获取intro_choices表中的数据
        response = supabase.table('intro_choices').select('*').execute()
        
        # 解析数据
        choices_data = response.data
        
        # 初始化计数
        yes_count = 0
        no_count = 0
        
        # 提取yes和no的计数
        for item in choices_data:
            if item['choice'] == 'yes':
                yes_count = item['count']
            elif item['choice'] == 'no':
                no_count = item['count']
        
        # 计算总数和百分比
        total = yes_count + no_count
        yes_percentage = round((yes_count / total) * 100) if total > 0 else 50  # 默认50%
        
        return jsonify({
            'yes_count': yes_count,
            'no_count': no_count,
            'total': total,
            'yes_percentage': yes_percentage
        })
    
    except Exception as e:
        print(f"Error getting intro stats: {e}")
        return jsonify({
            'yes_count': 0,
            'no_count': 0,
            'total': 0,
            'yes_percentage': 50,  # 默认50%
            'error': str(e)
        }), 500

@application.route('/question-response', methods=['POST'])
@require_database
def store_question_response():
    """
    Store a response for a questionnaire question
    Expects JSON: {
        "questionnaire_type": "mother/corporate/other/both",
        "question_id": 1,     # 可以是数字或字符串
        "original_question_id": 1,  # 原始问题ID
        "question_type": "multiple-choice/scale-question/text-input",
        "response_value": "A" or "1" or "text response"
    }
    """
    data = request.json
    
    # Validate required fields
    required_fields = ['questionnaire_type', 'question_id', 'original_question_id', 'question_type', 'response_value']
    missing_fields = [field for field in required_fields if field not in data]
    
    if missing_fields:
        return jsonify({"error": f"Missing required fields: {', '.join(missing_fields)}"}), 400
    
    # Extract data
    questionnaire_type = data['questionnaire_type']
    question_id = str(data['question_id'])  # 确保以字符串形式存储
    original_question_id = int(data['original_question_id'])  # 原始问题ID
    question_type = data['question_type']
    response_value = data['response_value']
    
    try:
        # For scale questions and multiple choice, we track counts
        if question_type in ['scale-question', 'multiple-choice']:
            # Check if record exists
            result = supabase.table('question_responses').select('*').eq('questionnaire_type', questionnaire_type).eq('question_id', question_id).eq('response_value', response_value).execute()
            
            if result.data:
                # Update existing record
                count = result.data[0]['count'] + 1
                supabase.table('question_responses').update({'count': count}).eq('id', result.data[0]['id']).execute()
            else:
                # Insert new record
                result = supabase.table('question_responses').insert({
                    'questionnaire_type': questionnaire_type,
                    'question_id': question_id,
                    'original_question_id': original_question_id,
                    'question_type': question_type,
                    'response_value': response_value,
                    'count': 1
                }).execute()
                ensure_supabase_ok(result, "Failed to insert question response")
                
            return jsonify({"message": "Question response stored successfully"}), 200
        
        # For text inputs, store in question_responses with is_text_response flag
        elif question_type == 'text-input':
            text_response_data = {
                'questionnaire_type': questionnaire_type,
                'question_id': question_id,
                'original_question_id': original_question_id,
                'question_type': question_type,
                'response_text': response_value,
                'is_text_response': True
            }
            
            # Add user_session_id if provided
            user_session_id = data.get('user_session_id')
            if user_session_id:
                text_response_data['user_session_id'] = user_session_id
            
            result = supabase.table('question_responses').insert(text_response_data).execute()
            ensure_supabase_ok(result, "Failed to insert text response")
            
            return jsonify({"message": "Text response stored successfully"}), 200
        
        else:
            return jsonify({"error": f"Invalid question type: {question_type}"}), 400
    
    except Exception as e:
        print(f"Error storing question response: {str(e)}")
        return jsonify({"error": str(e)}), 500

@application.route('/batch-question-responses', methods=['POST'])
@require_database
def batch_save_question_responses():
    """
    批量保存问卷回答
    期望的JSON格式:
    {
        "responses": [
            {
                "questionnaire_type": "mother",
                "question_id": 1,     # 唯一ID，可以是数字或字符串
                "original_question_id": 1,  # 原始问题ID
                "question_type": "multiple-choice",
                "response_value": "A"
            },
            ... 更多回答 ...
        ]
    }
    """
    data = request.get_json()
    responses = data.get('responses', [])
    
    if not responses:
        return jsonify({'error': 'No responses provided'}), 400
    
    # Get user_session_id from request if provided
    user_session_id = data.get('user_session_id')
    
    try:
        # 使用Supabase批量插入
        for response in responses:
            # 确保question_id以字符串形式存储
            question_id = str(response.get('question_id'))
            original_question_id = int(response.get('original_question_id'))
            
            question_type = response.get('question_type')
            
            response_data = {
                'questionnaire_type': response.get('questionnaire_type'),
                'question_id': question_id,
                'original_question_id': original_question_id,
                'question_type': question_type
            }
            
            # Handle text vs other response types
            if question_type == 'text-input':
                response_data['response_text'] = response.get('response_value')
                response_data['is_text_response'] = True
            else:
                response_data['response_value'] = response.get('response_value')
                response_data['is_text_response'] = False
            
            # Add user_session_id if provided
            if user_session_id:
                response_data['user_session_id'] = user_session_id
            
            result = supabase.table('question_responses').insert(response_data).execute()
            ensure_supabase_ok(result, "Failed to insert batch question response")
        
        return jsonify({
            'success': True,
            'message': f'Successfully saved {len(responses)} responses',
            'count': len(responses)
        })
    
    except Exception as e:
        print(f"Error saving batch responses: {e}")
        return jsonify({'error': str(e)}), 500

@application.route('/get-question-stats', methods=['GET'])
@require_database
def get_question_stats():
    """
    Get statistics for a specific question
    Query parameters:
    - questionnaire_type: mother/corporate/other/both
    - question_id: number or string (唯一ID)
    - original_question_id: number (可选，原始问题ID)
    """
    questionnaire_type = request.args.get('questionnaire_type')
    question_id = request.args.get('question_id')
    original_question_id = request.args.get('original_question_id')
    
    if not questionnaire_type:
        return jsonify({"error": "Missing required parameter: questionnaire_type"}), 400
    
    if not question_id and not original_question_id:
        return jsonify({"error": "Missing required parameter: either question_id or original_question_id must be provided"}), 400
    
    try:
        # 构建查询
        query = supabase.table('question_responses').select('*').eq('questionnaire_type', questionnaire_type)
        
        # 根据提供的ID类型进行查询
        if question_id:
            query = query.eq('question_id', question_id)
        elif original_question_id:
            query = query.eq('original_question_id', int(original_question_id))
            
        result = query.execute()
            
        return jsonify({"data": result.data}), 200
    except Exception as e:
        print(f"Error retrieving question stats: {str(e)}")
        return jsonify({"error": str(e)}), 500

@application.route('/email/send-verification', methods=['POST'])
@require_database
def send_verification_email():
    """
    Send verification email to the user
    Expects JSON: {"email": "user@company.com", "language": "en"}
    """
    data = request.get_json()
    email = data.get('email')
    language = data.get('language', 'en')
    questionnaire_type = data.get('questionnaire_type', 'mother')
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
    
    # Basic email validation
    if '@' not in email or '.' not in email.split('@')[1]:
        return jsonify({"error": "Invalid email format"}), 400
    
    try:
        # Generate unique verification token
        verification_token = str(uuid.uuid4())
        session_token = str(uuid.uuid4())
        
        # Calculate expiration (24 hours from now)
        expires_at = datetime.utcnow() + timedelta(hours=24)
        
        # Get user_session_id if provided
        user_session_id = data.get('user_session_id')
        
        # Check if there's an existing unverified record
        existing = supabase.table('email_verifications').select('*').eq('email', email).eq('is_verified', False).execute()
        
        email_verification_data = {
            'email': email,
            'verification_token': verification_token,
            'session_token': session_token,
            'expires_at': expires_at.isoformat(),
            'is_verified': False,
            'questionnaire_type': questionnaire_type
        }
        
        # Add user_session_id if provided
        if user_session_id:
            email_verification_data['user_session_id'] = user_session_id
        
        if existing.data:
            # Update existing record
            update_data = {
                'verification_token': verification_token,
                'expires_at': expires_at.isoformat()
            }
            if user_session_id:
                update_data['user_session_id'] = user_session_id
            
            supabase.table('email_verifications').update(update_data).eq('id', existing.data[0]['id']).execute()
        else:
            # Insert new record
            supabase.table('email_verifications').insert(email_verification_data).execute()
        
        # Send verification email (optional - can skip if SendGrid not configured)
        verification_link = f"{FRONTEND_URL}/personality-test?verify={verification_token}"
        
        try:
            if sendgrid_client:
                # Email templates
                if language == 'zh':
                    subject = "CHON 邮箱验证"
                    content = f"""
                    <html>
                    <body style="font-family: 'Microsoft YaHei', Arial, sans-serif;">
                        <h2>CHON 邮箱验证</h2>
                        <p>感谢您参与 CHON 调查问卷。</p>
                        <p>请点击下方按钮验证您的邮箱地址并继续问卷：</p>
                        <a href="{verification_link}" style="background-color: #F0BDC0; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">验证我的邮箱</a>
                        <p>或将此链接复制粘贴到您的浏览器：</p>
                        <p>{verification_link}</p>
                        <p>此链接将在24小时后过期。</p>
                        <p>如果您没有请求此验证，请忽略此邮件。</p>
                    </body>
                    </html>
                    """
                else:
                    subject = "CHON Email Verification"
                    content = f"""
                    <html>
                    <body style="font-family: Arial, sans-serif;">
                        <h2>CHON Email Verification</h2>
                        <p>Thank you for participating in the CHON questionnaire.</p>
                        <p>Please click the button below to verify your email address and continue with the questionnaire:</p>
                        <a href="{verification_link}" style="background-color: #F0BDC0; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify My Email</a>
                        <p>Or copy and paste this link into your browser:</p>
                        <p>{verification_link}</p>
                        <p>This link will expire in 24 hours.</p>
                        <p>If you didn't request this verification, please ignore this email.</p>
                    </body>
                    </html>
                    """
                
                message = Mail(
                    from_email=(EMAIL_FROM, EMAIL_FROM_NAME),
                    to_emails=email,
                    subject=subject,
                    html_content=content
                )
                sendgrid_client.send(message)
                print(f"Verification email sent to {email}")
            else:
                # Development mode: just print the link
                print(f"\n{'='*60}")
                print(f"DEVELOPMENT MODE: Email verification skipped")
                print(f"Verification link for {email}:")
                print(f"{verification_link}")
                print(f"{'='*60}\n")
        except Exception as email_error:
            # If email sending fails, just log it but continue
            print(f"Email sending failed (SendGrid not configured): {email_error}")
            print(f"Verification link: {verification_link}")
        
        return jsonify({
            "success": True,
            "message": "Email verification record created successfully",
            "verificationToken": verification_token
        }), 200
        
    except Exception as e:
        print(f"Error sending verification email: {str(e)}")
        return jsonify({"error": str(e)}), 500

@application.route('/email/verify/<token>', methods=['GET'])
@require_database
def verify_email_token(token):
    """
    Verify email token and mark as verified
    Returns session token for authenticated access
    """
    try:
        # Look up the token
        result = supabase.table('email_verifications').select('*').eq('verification_token', token).execute()
        
        if not result.data:
            return jsonify({"error": "Invalid verification token"}), 400
        
        record = result.data[0]
        
        # Check if already verified
        if record['is_verified']:
            return jsonify({
                "success": True,
                "message": "Email already verified",
                "sessionToken": record['session_token']
            }), 200
        
        # Check if expired
        expires_at = datetime.fromisoformat(record['expires_at'].replace('Z', '+00:00'))
        if datetime.utcnow() > expires_at:
            return jsonify({"error": "Verification token has expired"}), 400
        
        # Mark as verified and update verified_at
        supabase.table('email_verifications').update({
            'is_verified': True,
            'verified_at': datetime.utcnow().isoformat()
        }).eq('verification_token', token).execute()
        
        return jsonify({
            "success": True,
            "message": "Email verified successfully",
            "sessionToken": record['session_token'],
            "email": record['email']
        }), 200
        
    except Exception as e:
        print(f"Error verifying email token: {str(e)}")
        return jsonify({"error": str(e)}), 500

@application.route('/email/resend-verification', methods=['POST'])
@require_database
def resend_verification_email():
    """
    Resend verification email
    Expects JSON: {"email": "user@company.com", "language": "en"}
    """
    data = request.get_json()
    email = data.get('email')
    language = data.get('language', 'en')
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
    
    try:
        # Generate new verification token
        verification_token = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(hours=24)
        
        # Update or insert new token
        existing = supabase.table('email_verifications').select('*').eq('email', email).execute()
        
        if existing.data:
            supabase.table('email_verifications').update({
                'verification_token': verification_token,
                'expires_at': expires_at.isoformat(),
                'is_verified': False,
                'verified_at': None
            }).eq('email', email).execute()
        else:
            session_token = str(uuid.uuid4())
            supabase.table('email_verifications').insert({
                'email': email,
                'verification_token': verification_token,
                'session_token': session_token,
                'expires_at': expires_at.isoformat(),
                'is_verified': False
            }).execute()
        
        # Send email (same code as send_verification_email)
        verification_link = f"{FRONTEND_URL}/personality-test?verify={verification_token}"
        
        # Use same email templates as above
        if language == 'zh':
            subject = "CHON 邮箱验证"
        else:
            subject = "CHON Email Verification"
        
        if sendgrid_client:
            # Send email using SendGrid
            content = f"Click here to verify: {verification_link}"
            message = Mail(
                from_email=(EMAIL_FROM, EMAIL_FROM_NAME),
                to_emails=email,
                subject=subject,
                html_content=content
            )
            sendgrid_client.send(message)
        else:
            print(f"DEVELOPMENT MODE: Resend verification link for {email}: {verification_link}")
        
        return jsonify({
            "success": True,
            "message": "Verification email resent successfully"
        }), 200
        
    except Exception as e:
        print(f"Error resending verification email: {str(e)}")
        return jsonify({"error": str(e)}), 500

@application.route('/email/status/<email>', methods=['GET'])
@require_database
def check_verification_status(email):
    """
    Check if email is verified
    Returns verification status and session token if verified
    """
    try:
        result = supabase.table('email_verifications').select('*').eq('email', email).execute()
        
        if not result.data:
            return jsonify({
                "verified": False,
                "email": email
            }), 200
        
        record = result.data[-1]  # Get most recent record
        
        return jsonify({
            "verified": record['is_verified'],
            "email": email,
            "sessionToken": record.get('session_token') if record['is_verified'] else None
        }), 200
        
    except Exception as e:
        print(f"Error checking verification status: {str(e)}")
        return jsonify({"error": str(e)}), 500

@application.route('/user-sessions', methods=['POST'])
@require_database
def create_user_session():
    """
    Create a new user session
    Expects JSON: {"intro_choice": "yes", "email": "user@co.com", "questionnaire_type": "mother", "corporate_role": "ceo"}
    """
    data = request.get_json()
    
    intro_choice = data.get('intro_choice')
    email = data.get('email')
    questionnaire_type = data.get('questionnaire_type')
    corporate_role = data.get('corporate_role')
    
    try:
        # Generate tokens
        session_token = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(days=30)
        
        # Create session
        result = supabase.table('user_sessions').insert({
            'intro_choice': intro_choice,
            'email': email,
            'questionnaire_type': questionnaire_type,
            'corporate_role': corporate_role if questionnaire_type == 'corporate' else None,
            'session_token': session_token,
            'email_verified': False if email else True,
            'questionnaire_completed': False,
            'expires_at': expires_at.isoformat()
        }).execute()
        ensure_supabase_ok(result, "Failed to create user session")
        if not result.data:
            raise Exception("Failed to create user session: no data returned")
        
        return jsonify({
            'success': True,
            'user_session_id': result.data[0]['id'],
            'session_token': session_token
        }), 200
        
    except Exception as e:
        print(f"Error creating user session: {str(e)}")
        return jsonify({"error": str(e)}), 500

@application.route('/tag-scores', methods=['POST'])
@require_database
def save_tag_scores():
    """
    Save tag scores for a user session
    Expects JSON: {
        "user_session_id": "abc-123",
        "tag_scores": [
            {"tag_chinese": "自我意识", "unified_question_id": 5, "score": 80},
            ...
        ]
    }
    """
    data = request.get_json()
    user_session_id = data.get('user_session_id')
    tag_scores = data.get('tag_scores', [])
    
    if not user_session_id:
        return jsonify({"error": "user_session_id is required"}), 400
    
    if not tag_scores:
        return jsonify({"error": "tag_scores array is required"}), 400
    
    try:
        for score in tag_scores:
            result = supabase.table('tag_scores').insert({
                'user_session_id': user_session_id,
                'tag_english': score['tag_english'],
                'unified_question_id': score['unified_question_id'],
                'score': score['score']
            }).execute()
            ensure_supabase_ok(result, "Failed to insert tag score")
        
        return jsonify({
            'success': True,
            'message': f'Successfully saved {len(tag_scores)} tag scores',
            'count': len(tag_scores)
        }), 200
        
    except Exception as e:
        print(f"Error saving tag scores: {str(e)}")
        return jsonify({"error": str(e)}), 500

@application.route('/tag-statistics', methods=['POST'])
@require_database
def save_tag_statistics():
    """
    Save tag statistics for a user session
    Expects JSON: {
        "user_session_id": "abc-123",
        "statistics": [
            {
                "tag_chinese": "自我意识",
                "user_score": 380,
                "total_possible_score": 500,
                "score_percentage": 76,
                "average_score": 76,
                "answered_questions": 5,
                "question_25_bonus_applied": false
            },
            ...
        ]
    }
    """
    data = request.get_json()
    user_session_id = data.get('user_session_id')
    statistics = data.get('statistics', [])
    
    if not user_session_id:
        return jsonify({"error": "user_session_id is required"}), 400
    
    if not statistics:
        return jsonify({"error": "statistics array is required"}), 400
    
    try:
        for stat in statistics:
            result = supabase.table('tag_statistics').insert({
                'user_session_id': user_session_id,
                'tag_english': stat['tag_english'],
                'user_score': stat['user_score'],
                'total_possible_score': stat['total_possible_score'],
                'score_percentage': stat['score_percentage'],
                'answered_questions': stat['answered_questions'],
                'question_25_bonus_applied': stat.get('question_25_bonus_applied', False),
                'question_25_bonus_tag': stat.get('question_25_bonus_tag')
            }).execute()
            ensure_supabase_ok(result, "Failed to insert tag statistics")
        
        return jsonify({
            'success': True,
            'message': f'Successfully saved statistics for {len(statistics)} tags',
            'count': len(statistics)
        }), 200
        
    except Exception as e:
        print(f"Error saving tag statistics: {str(e)}")
        return jsonify({"error": str(e)}), 500

@application.route('/character-matches', methods=['POST'])
@require_database
def save_character_matches():
    """
    Save character matches for a user session
    Expects JSON: {
        "user_session_id": "abc-123",
        "matches": [
            {
                "character_id": "odin",
                "match_rank": 1,
                "in_range_count": 5,
                "out_of_range_diff_sum": 0,
                "final_percentage": 85,
                "question_25_answer": "C"
            },
            ...
        ]
    }
    """
    data = request.get_json()
    user_session_id = data.get('user_session_id')
    matches = data.get('matches', [])
    
    if not user_session_id:
        return jsonify({"error": "user_session_id is required"}), 400
    
    if not matches:
        return jsonify({"error": "matches array is required"}), 400
    
    try:
        # Save all matches
        for match in matches:
            result = supabase.table('character_matches').insert({
                'user_session_id': user_session_id,
                'character_id': match['character_id'],
                'match_rank': match['match_rank'],
                'in_range_count': match.get('in_range_count'),
                'out_of_range_diff_sum': match.get('out_of_range_diff_sum'),
                'final_percentage': match['final_percentage'],
                'question_25_answer': match.get('question_25_answer')
            }).execute()
            ensure_supabase_ok(result, "Failed to insert character match")
        
        # Update user_sessions with best match (rank 1)
        best_match = next((m for m in matches if m['match_rank'] == 1), None)
        if best_match:
            result = supabase.table('user_sessions').update({
                'character_match': best_match['character_id'],
                'completed_at': datetime.utcnow().isoformat(),
                'questionnaire_completed': True
            }).eq('id', user_session_id).execute()
            ensure_supabase_ok(result, "Failed to update user session with best match")
        
        return jsonify({
            'success': True,
            'message': f'Successfully saved {len(matches)} character matches',
            'count': len(matches),
            'best_match': best_match['character_id'] if best_match else None
        }), 200
        
    except Exception as e:
        print(f"Error saving character matches: {str(e)}")
        return jsonify({"error": str(e)}), 500

@application.route('/user-sessions/<session_id>', methods=['GET'])
@require_database
def get_user_session(session_id):
    """
    Get user session data
    """
    try:
        result = supabase.table('user_sessions').select('*').eq('id', session_id).execute()
        
        if not result.data:
            return jsonify({"error": "User session not found"}), 404
        
        return jsonify(result.data[0]), 200
        
    except Exception as e:
        print(f"Error retrieving user session: {str(e)}")
        return jsonify({"error": str(e)}), 500

@application.route('/user-accounts', methods=['POST'])
@require_database
def create_user_account():
    """
    Create a user account linked to a user session.
    Expects JSON: {"email": "...", "password": "...", "user_session_id": "...", "name": "..."}
    """
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    user_session_id = data.get('user_session_id')
    name = data.get('name')

    if not email or not password or not user_session_id:
        return jsonify({"error": "email, password, and user_session_id are required"}), 400

    try:
        password_hash = generate_password_hash(password)
        result = supabase.table('user_accounts').insert({
            'email': email,
            'password_hash': password_hash,
            'user_session_id': user_session_id,
            'name': name
        }).execute()
        ensure_supabase_ok(result, "Failed to create user account")

        return jsonify({"success": True, "message": "User account created"}), 200
    except Exception as e:
        print(f"Error creating user account: {str(e)}")
        return jsonify({"error": str(e)}), 500

@application.route('/auth/callback', methods=['POST'])
@require_database
def auth_callback_sync():
    """
    Sync email verification status on auth callback.
    Expects JSON: {"email": "...", "auth_user_id": "..."}
    """
    data = request.get_json()
    email = data.get('email')
    auth_user_id = data.get('auth_user_id')

    if not email:
        return jsonify({"error": "email is required"}), 400

    try:
        update_verification = {
            'is_verified': True,
            'verified_at': datetime.utcnow().isoformat()
        }

        # Update latest email_verifications row
        latest = supabase.table('email_verifications').select('id').eq('email', email).order('created_at', desc=True).limit(1).execute()
        if latest.data:
            supabase.table('email_verifications').update(update_verification).eq('id', latest.data[0]['id']).execute()
        else:
            supabase.table('email_verifications').insert({
                'email': email,
                'verification_token': auth_user_id or str(uuid.uuid4()),
                'session_token': str(uuid.uuid4()),
                'is_verified': True,
                'verified_at': datetime.utcnow().isoformat(),
                'expires_at': (datetime.utcnow() + timedelta(days=30)).isoformat()
            }).execute()

        # Update latest user_session row
        latest_session = supabase.table('user_sessions').select('id').eq('email', email).order('created_at', desc=True).limit(1).execute()
        if latest_session.data:
            supabase.table('user_sessions').update({
                'email_verified': True
            }).eq('id', latest_session.data[0]['id']).execute()

        return jsonify({"success": True}), 200
    except Exception as e:
        print(f"Error syncing auth callback: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    application.run(host='0.0.0.0', port=port)
