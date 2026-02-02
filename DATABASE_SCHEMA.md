# CHON Database Schema Documentation

Complete documentation of all database tables and data storage.

---

## Overview

**Database Type:** PostgreSQL (Supabase)  
**Total Tables:** 8 tables + 1 view (+ auth.users)  
**Primary Key Strategy:** UUID for user sessions, INTEGER IDENTITY for question_responses, SERIAL for others  
**Foreign Keys:** All user data linked to `user_sessions.id`

---

## Table of Contents

1. [intro_choices](#1-intro_choices) - Aggregate intro responses
2. [user_sessions](#2-user_sessions) - Individual user tracking
3. [question_responses](#3-question_responses) - All question answers
4. [email_verifications](#4-email_verifications) - Email verification tracking
5. [tag_scores](#5-tag_scores) - Individual question scores per tag
6. [tag_statistics](#6-tag_statistics) - Calculated tag statistics
7. [character_matches](#7-character_matches) - Character matching results
8. [user_accounts](#8-user_accounts) - User login credentials
9. [text_responses (VIEW)](#9-text_responses-view) - Text response view
10. [auth.users (Supabase)](#10-authusers-supabase) - Supabase Auth users

---

## 1. intro_choices

**Purpose:** Store aggregate counts of intro question responses (yes/no)

### Schema
```sql
CREATE TABLE intro_choices (
    choice VARCHAR(10) PRIMARY KEY CHECK (choice IN ('yes', 'no')),
    count INTEGER NOT NULL DEFAULT 0
);
```

### Columns
| Column | Type | Description |
|--------|------|-------------|
| `choice` | VARCHAR(10) | 'yes' or 'no' (PRIMARY KEY) |
| `count` | INTEGER | Number of users who selected this choice |

### Data
```
┌─────────┬───────┐
│ choice  │ count │
├─────────┼───────┤
│ yes     │ 150   │
│ no      │ 75    │
└─────────┴───────┘
```

### Indexes
- PRIMARY KEY on `choice`

### API Endpoints
- `POST /api/intro-choice` - Increment count
- `GET /api/intro-stats` - Get statistics

---

## 2. user_sessions

**Purpose:** Track individual user sessions from start to completion

### Schema
```sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intro_choice VARCHAR(10) CHECK (intro_choice IN ('yes', 'no')),
    email VARCHAR(255),
    questionnaire_type VARCHAR(50) CHECK (questionnaire_type IN ('mother', 'corporate', 'other', 'both')),
    corporate_role VARCHAR(100),
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255) UNIQUE,
    session_token VARCHAR(255) UNIQUE,
    verification_token_expires_at TIMESTAMP WITH TIME ZONE,
    questionnaire_completed BOOLEAN DEFAULT FALSE,
    character_match VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);
```

### Columns
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique session identifier (PRIMARY KEY) |
| `intro_choice` | VARCHAR(10) | User's intro yes/no answer |
| `email` | VARCHAR(255) | User's email address |
| `questionnaire_type` | VARCHAR(50) | 'mother', 'corporate', 'other', 'both' |
| `corporate_role` | VARCHAR(100) | Role if corporate (e.g., 'CEO', 'VP') |
| `email_verified` | BOOLEAN | Email verification status |
| `verification_token` | VARCHAR(255) | Email verification token |
| `session_token` | VARCHAR(255) | Session authentication token |
| `verification_token_expires_at` | TIMESTAMP | When verification expires |
| `questionnaire_completed` | BOOLEAN | Completion status |
| `character_match` | VARCHAR(50) | Best matched character |
| `created_at` | TIMESTAMP | When session created |
| `completed_at` | TIMESTAMP | When questionnaire completed |
| `expires_at` | TIMESTAMP | Session expiration |


### Indexes
- PRIMARY KEY on `id`
- INDEX on `email`
- INDEX on `verification_token`
- INDEX on `session_token`
- INDEX on `questionnaire_type`
- INDEX on `questionnaire_completed`
- INDEX on `corporate_role`

### API Endpoints
- `POST /api/user-sessions` - Create session
- `GET /api/user-sessions/:id` - Get session data

---

## 3. question_responses

**Purpose:** Store all questionnaire answers (multiple-choice, scale, and text)

### Schema
```sql
CREATE TABLE question_responses (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1),
    user_session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE,
    questionnaire_type VARCHAR(20) CHECK (questionnaire_type IN ('mother', 'corporate', 'other', 'both')),
    question_id VARCHAR(50) NOT NULL,
    original_question_id INTEGER NOT NULL,
    question_type VARCHAR(20) CHECK (question_type IN ('multiple-choice', 'scale-question', 'text-input')),
    response_value VARCHAR(50),
    response_text TEXT,
    is_text_response BOOLEAN DEFAULT FALSE,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Columns
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-incrementing integer starting from 1 (PRIMARY KEY) |
| `user_session_id` | UUID | Links to user_sessions (FOREIGN KEY) |
| `questionnaire_type` | VARCHAR(20) | Which questionnaire |
| `question_id` | VARCHAR(50) | Question identifier (e.g., 'mother_5') |
| `original_question_id` | INTEGER | Unified question number |
| `question_type` | VARCHAR(20) | Type of question |
| `response_value` | VARCHAR(50) | Answer for MC/scale (e.g., 'A', '3') |
| `response_text` | TEXT | Answer for text inputs |
| `is_text_response` | BOOLEAN | Flag for text vs other |
| `score` | INTEGER | Calculated score (0-100) for scale questions |
| `count` | INTEGER | Aggregate count (for old data) |
| `created_at` | TIMESTAMP | When answered |
| `updated_at` | TIMESTAMP | Last updated |

### Example Data
```
┌────┬──────────────────────────────────┬────────────────────┬──────────────┬──────────────────┬──────────────┬────────────┬────────┐
│ id │ user_session_id                  │ questionnaire_type │ question_id │ question_type    │ response_   │ score │ is_text │
│    │                                  │                    │             │                  │ value        │       │ response│
├────┼──────────────────────────────────┼────────────────────┼──────────────┼──────────────────┼──────────────┼────────┼────────┤
│ 1  │ abc-123-xyz                      │ mother            │ mother_5    │ scale-question  │ 4            │ 80    │ FALSE  │
│ 2  │ abc-123-xyz                      │ mother            │ mother_8    │ text-input      │ NULL         │ NULL  │ TRUE   │
└────┴──────────────────────────────────┴────────────────────┴──────────────┴──────────────────┴──────────────┴────────┴────────┘
```

### Indexes
- PRIMARY KEY on `id`
- INDEX on `user_session_id`
- INDEX on `questionnaire_type, question_id`
- INDEX on `is_text_response`

### API Endpoints
- `POST /api/question-response` - Save single response
- `POST /api/batch-question-responses` - Save multiple responses
- `GET /api/get-question-stats` - Get question statistics

---

## 4. email_verifications

**Purpose:** Track email verification process

### Schema
```sql
CREATE TABLE email_verifications (
    id SERIAL PRIMARY KEY,
    user_session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    verification_token VARCHAR(255) UNIQUE NOT NULL,
    session_token VARCHAR(255) UNIQUE,
    is_verified BOOLEAN DEFAULT FALSE,
    questionnaire_type VARCHAR(50) CHECK (questionnaire_type IN ('mother', 'corporate', 'other', 'both')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE
);
```

### Columns
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Auto-increment ID (PRIMARY KEY) |
| `user_session_id` | UUID | Links to user_sessions (FOREIGN KEY) |
| `email` | VARCHAR(255) | User's email |
| `verification_token` | VARCHAR(255) | Unique verification token |
| `session_token` | VARCHAR(255) | Session token after verification |
| `is_verified` | BOOLEAN | Verification status |
| `questionnaire_type` | VARCHAR(50) | Which questionnaire |
| `created_at` | TIMESTAMP | When created |
| `expires_at` | TIMESTAMP | Token expiration (24 hours) |
| `verified_at` | TIMESTAMP | When verified |

### Example Data
```
┌────┬──────────────────────────────────┬──────────────┬─────────────┬────────────────────┬─────────────────────┐
│ id │ user_session_id                  │ email        │ is_verified │ questionnaire_type │ verified_at         │
├────┼──────────────────────────────────┼──────────────┼─────────────┼────────────────────┼─────────────────────┤
│ 1  │ abc-123-xyz                      │ user@co.com │ TRUE        │ mother             │ 2024-01-15 10:05:00│
└────┴──────────────────────────────────┴──────────────┴─────────────┴────────────────────┴─────────────────────┘
```

### Indexes
- PRIMARY KEY on `id`
- UNIQUE on `verification_token`
- UNIQUE on `session_token`
- INDEX on `email`
- INDEX on `user_session_id`
- INDEX on `expires_at`

### API Endpoints
- `POST /api/email/send-verification` - Send verification email
- `GET /api/email/verify/:token` - Verify token
- `POST /api/email/resend-verification` - Resend email
- `GET /api/email/status/:email` - Check status

---

## 5. tag_scores

**Purpose:** Store individual question scores for each tag

### Schema
```sql
CREATE TABLE tag_scores (
    id SERIAL PRIMARY KEY,
    user_session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    tag_english VARCHAR(50) NOT NULL,
    unified_question_id INTEGER NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_session_id, tag_english, unified_question_id)
);
```

### Columns
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Auto-increment ID (PRIMARY KEY) |
| `user_session_id` | UUID | Links to user_sessions (FOREIGN KEY) |
| `tag_english` | VARCHAR(50) | Tag name (selfAwareness, dedication, etc.) |
| `unified_question_id` | INTEGER | Question number (5, 10, 15, etc.) |
| `score` | INTEGER | Score 0-100 |
| `created_at` | TIMESTAMP | When scored |

### Tag Names
- `selfAwareness` (自我意识)
- `dedication` (奉献精神)
- `socialIntelligence` (社交情商)
- `emotionalRegulation` (情绪调节)
- `objectivity` (客观能力)
- `coreEndurance` (核心耐力)

### Example Data
```
┌────┬──────────────────────────────────┬──────────────────┬────────────────────┬───────┐
│ id │ user_session_id                  │ tag_english      │ unified_question_id│ score │
├────┼──────────────────────────────────┼──────────────────┼────────────────────┼───────┤
│ 1  │ abc-123-xyz                      │ selfAwareness    │ 5                  │ 80    │
│ 2  │ abc-123-xyz                      │ selfAwareness    │ 10                 │ 100   │
│ 3  │ abc-123-xyz                      │ dedication       │ 5                  │ 60    │
└────┴──────────────────────────────────┴──────────────────┴────────────────────┴───────┘
```

### Indexes
- PRIMARY KEY on `id`
- INDEX on `user_session_id`
- INDEX on `tag_english`
- INDEX on `unified_question_id`
- UNIQUE on `(user_session_id, tag_english, unified_question_id)`

### API Endpoints
- `POST /api/tag-scores` - Save tag scores

---

## 6. tag_statistics

**Purpose:** Store calculated statistics for each tag per user

### Schema
```sql
CREATE TABLE tag_statistics (
    id SERIAL PRIMARY KEY,
    user_session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    tag_english VARCHAR(50) NOT NULL,
    user_score INTEGER NOT NULL,
    total_possible_score INTEGER NOT NULL,
    score_percentage INTEGER NOT NULL CHECK (score_percentage >= 0 AND score_percentage <= 100),
    answered_questions INTEGER NOT NULL CHECK (answered_questions >= 0),
    question_25_bonus_applied BOOLEAN DEFAULT FALSE,
    question_25_bonus_tag VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_session_id, tag_english)
);
```

### Columns
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Auto-increment ID (PRIMARY KEY) |
| `user_session_id` | UUID | Links to user_sessions (FOREIGN KEY) |
| `tag_english` | VARCHAR(50) | Tag name |
| `user_score` | INTEGER | Sum of all scores for this tag |
| `total_possible_score` | INTEGER | Maximum possible score |
| `score_percentage` | INTEGER | Percentage (0-100) |
| `answered_questions` | INTEGER | Number of questions answered |
| `question_25_bonus_applied` | BOOLEAN | Whether Q25 bonus applied |
| `bonus_question_tag` | VARCHAR(50) | Which tag got the bonus |
| `created_at` | TIMESTAMP | When calculated |

### Example Data
```
┌────┬──────────────────────────────────┬──────────────────┬────────────┬──────────────────────┬──────────────────┬───────────────────┐
│ id │ user_session_id                  │ tag_english      │ user_score │ total_possible_score │ score_percentage │ answered_questions│
├────┼──────────────────────────────────┼──────────────────┼────────────┼──────────────────────┼──────────────────┼───────────────────┤
│ 1  │ abc-123-xyz                      │ selfAwareness    │ 380        │ 500                  │ 76               │ 5                 │
│ 2  │ abc-123-xyz                      │ dedication       │ 420        │ 500                  │ 84               │ 5                 │
└────┴──────────────────────────────────┴──────────────────┴────────────┴──────────────────────┴──────────────────┴───────────────────┘
```

### Indexes
- PRIMARY KEY on `id`
- INDEX on `user_session_id`
- INDEX on `tag_english`
- UNIQUE on `(user_session_id, tag_english)`

### API Endpoints
- `POST /api/tag-statistics` - Save statistics

---

## 7. character_matches

**Purpose:** Store character matching results and rankings

### Schema
```sql
CREATE TABLE character_matches (
    id SERIAL PRIMARY KEY,
    user_session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    character_id VARCHAR(50) NOT NULL,
    match_rank INTEGER NOT NULL,
    in_range_count INTEGER,
    out_of_range_diff_sum INTEGER,
    final_percentage INTEGER NOT NULL CHECK (final_percentage >= 0 AND final_percentage <= 100),
    question_25_answer VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Columns
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Auto-increment ID (PRIMARY KEY) |
| `user_session_id` | UUID | Links to user_sessions (FOREIGN KEY) |
| `character_id` | VARCHAR(50) | Character name (lowercase) |
| `match_rank` | INTEGER | Ranking (1=best match) |
| `in_range_count` | INTEGER | Skills within character's range |
| `out_of_range_diff_sum` | INTEGER | Sum of out-of-range differences |
| `final_percentage` | INTEGER | Match quality (0-100) |
| `bonus_question_answer` | VARCHAR(10) | User's Q25 answer ('A'-'F') |
| `created_at` | TIMESTAMP | When calculated |

### Characters
- `prometheus` (Prometheus)
- `wukong` (Sun Wukong)
- `odin` (Odin)
- `venus` (Venus)
- `nuwa` (Nüwa)
- `athena` (Athena)

### Example Data
```
┌────┬──────────────────────────────────┬───────────────┬────────────┬───────────────┬───────────────────────┬──────────────────┐
│ id │ user_session_id                  │ character_id │ match_rank │ in_range_count│ out_of_range_diff_sum │ final_percentage │
├────┼──────────────────────────────────┼───────────────┼────────────┼───────────────┼───────────────────────┼──────────────────┤
│ 1  │ abc-123-xyz                      │ odin         │ 1          │ 5             │ 0                     │ 85               │
│ 2  │ abc-123-xyz                      │ prometheus   │ 2          │ 4             │ 15                    │ 82               │
│ 3  │ abc-123-xyz                      │ athena       │ 3          │ 4             │ 20                    │ 78               │
└────┴──────────────────────────────────┴───────────────┴────────────┴───────────────┴───────────────────────┴──────────────────┘
```

### Indexes
- PRIMARY KEY on `id`
- INDEX on `user_session_id`
- INDEX on `character_id`
- INDEX on `match_rank`

### API Endpoints
- `POST /api/character-matches` - Save character matches

---

## 8. user_accounts

**Purpose:** Store user login credentials linked to a user session

### Schema
```sql
CREATE TABLE user_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Columns
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Account ID (PRIMARY KEY) |
| `user_session_id` | UUID | Links to user_sessions (FOREIGN KEY) |
| `email` | VARCHAR(255) | Account email (UNIQUE) |
| `password_hash` | TEXT | Hashed password |
| `name` | VARCHAR(100) | Optional display name |
| `created_at` | TIMESTAMP | When account created |

### Indexes
- PRIMARY KEY on `id`
- UNIQUE on `email`
- INDEX on `user_session_id`

### API Endpoints
- `POST /api/user-accounts` - Create user account
- `GET /api/user-accounts/:id` - Get account data

---

## 9. text_responses (VIEW)

**Purpose:** Backward compatibility view for text responses

### Schema
```sql
CREATE VIEW text_responses AS
SELECT 
    id,
    questionnaire_type,
    question_id,
    original_question_id,
    response_text,
    user_session_id,
    created_at,
    updated_at
FROM question_responses
WHERE is_text_response = TRUE;
```

### Description
This is a VIEW, not a table. It shows only text responses from `question_responses` where `is_text_response = TRUE`.

---

## Data Relationships

```
user_sessions (main)
    ├── tag_scores (FK: user_session_id)
    ├── tag_statistics (FK: user_session_id)
    ├── character_matches (FK: user_session_id)
    ├── question_responses (FK: user_session_id)
    ├── email_verifications (FK: user_session_id)
    └── user_accounts (FK: user_session_id)

intro_choices (standalone - aggregate only)
```

---

## Complete User Data Query

Get all data for a specific user:

```sql
-- User session info
SELECT * FROM user_sessions WHERE id = 'YOUR-SESSION-ID';

-- All question responses
SELECT * FROM question_responses WHERE user_session_id = 'YOUR-SESSION-ID';

-- Tag scores
SELECT * FROM tag_scores WHERE user_session_id = 'YOUR-SESSION-ID';

-- Tag statistics
SELECT * FROM tag_statistics WHERE user_session_id = 'YOUR-SESSION-ID';

-- Character matches
SELECT * FROM character_matches 
WHERE user_session_id = 'YOUR-SESSION-ID' 
ORDER BY match_rank;

-- Email verification
SELECT * FROM email_verifications WHERE user_session_id = 'YOUR-SESSION-ID';

-- User account
SELECT * FROM user_accounts WHERE user_session_id = 'YOUR-SESSION-ID';

-- Text responses only (using view)
SELECT * FROM text_responses WHERE user_session_id = 'YOUR-SESSION-ID';
```

---

## User Journey Data Flow

```
1. Intro Page
   └─> intro_choices (aggregate count) ✅
   └─> user_sessions.intro_choice (individual) ✅

2. Identity Selection
   └─> user_sessions.questionnaire_type ✅
   └─> user_sessions.corporate_role (if applicable) ✅

3. Email Verification
   └─> email_verifications ✅
   └─> Links to user_session_id ✅

4. Account Creation (optional)
   └─> user_accounts ✅
   └─> Links to user_session_id ✅

5. Answer Questions
   └─> question_responses (all types) ✅
   └─> Links to user_session_id ✅

6. Calculate Scores
   └─> tag_scores (per question per tag) ✅
   └─> tag_statistics (aggregated) ✅
   └─> Links to user_session_id ✅

7. Match Characters
   └─> character_matches (all 6 characters) ✅
   └─> user_sessions.character_match (best match) ✅
   └─> Links to user_session_id ✅
```


## Storage Summary

| Data Type | Table | Individual User | Aggregate | Notes |
|-----------|-------|-----------------|-----------|-------|
| Intro choice | `intro_choices` | ❌ | ✅ | Counts only |
| Intro choice | `user_sessions` | ✅ | ❌ | Per user |
| Email | `email_verifications` | ✅ | ❌ | Linked to session |
| User account | `user_accounts` | ✅ | ❌ | Email + password hash |
| Questionnaire type | `user_sessions` | ✅ | ❌ | Per user |
| Corporate role | `user_sessions` | ✅ | ❌ | Per user |
| Question answers | `question_responses` | ✅ | ⚠️ | Both (old=aggregate, new=individual) |
| Text responses | `question_responses` | ✅ | ❌ | Consolidated with is_text_response flag |
| Tag scores | `tag_scores` | ✅ | ❌ | Per question per tag |
| Tag statistics | `tag_statistics` | ✅ | ❌ | Calculated totals |
| Character match | `character_matches` | ✅ | ❌ | All 6 characters ranked |
| Best character | `user_sessions` | ✅ | ❌ | Best match only |

---

## Row Level Security (RLS)

All tables have RLS enabled with public access policies:
- `SELECT` - Public read access
- `INSERT` - Public insert access
- `UPDATE` - Public update access

**Note:** Customize RLS policies for production based on your authentication system.

---

## Auth Sync Hooks

**Purpose:** Keep `user_sessions` and `email_verifications` in sync with Supabase Auth.

### Behavior
- When a user is created or email confirmation changes in `auth.users`, a trigger updates:
  - `user_sessions.email_verified`
  - `user_sessions.verification_token` / `session_token` (set to auth user id)
  - `email_verifications.is_verified` / `verified_at`

### Migration
See `backend/migrations/08_auth_sync.sql`.

---

## Timestamps

All tables include timestamp tracking:
- `created_at` - Automatically set on INSERT
- `updated_at` - Automatically updated on UPDATE (via triggers)
- `completed_at` - Set when user completes questionnaire
- `verified_at` - Set when email verified
- `expires_at` - Set for session/token expiration

---

## Data Retention

- **User sessions:** Expire after 30 days (`expires_at`)
- **Email verifications:** Expire after 24 hours (`expires_at`)
- **Cascading deletes:** All related data deleted when user_session deleted

---

## Analytics Queries

### Users by questionnaire type
```sql
SELECT questionnaire_type, COUNT(*) 
FROM user_sessions 
GROUP BY questionnaire_type;
```

### Most common character matches
```sql
SELECT cm.character_id, COUNT(*) as match_count
FROM character_matches cm
WHERE cm.match_rank = 1
GROUP BY cm.character_id
ORDER BY match_count DESC;
```

### Average tag scores across all users
```sql
SELECT 
    tag_english,
    AVG(score_percentage) as avg_percentage
FROM tag_statistics
GROUP BY tag_english
ORDER BY avg_percentage DESC;
```

### Intro choice vs character match correlation
```sql
SELECT 
    us.intro_choice,
    cm.character_id,
    COUNT(*) as count
FROM user_sessions us
JOIN character_matches cm ON us.id = cm.user_session_id
WHERE cm.match_rank = 1
GROUP BY us.intro_choice, cm.character_id
ORDER BY count DESC;
```

### Corporate role distribution
```sql
SELECT 
    corporate_role,
    COUNT(*) as count
FROM user_sessions
WHERE questionnaire_type = 'corporate' AND corporate_role IS NOT NULL
GROUP BY corporate_role
ORDER BY count DESC;
```

