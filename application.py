import json
import math
import os
import urllib.error
import urllib.request
import uuid
from urllib.parse import urlencode
import threading
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Optional, Set
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client
from werkzeug.security import generate_password_hash, check_password_hash

# Load environment variables
load_dotenv()

application = Flask(__name__)
# Configure CORS for web + API domains (localhost for Vite / Docker dev on :5173, :3000, etc.)
_cors_base = [
    "https://www.chonlife.com",
    "https://chonlife.com",
    "https://app.chonlife.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
_cors_extra = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
CORS(
    application,
    origins=list(dict.fromkeys(_cors_base + _cors_extra)),
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

# Email configuration
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://www.chonlife.com")
EMAIL_FROM = os.getenv("EMAIL_FROM", "contact@chon.life")
EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "CHON")
# Postmark: https://postmarkapp.com — Server API token (same as used before SendGrid was introduced in code)
POSTMARK_SERVER_TOKEN = (
    os.getenv("POSTMARK_SERVER_TOKEN", "").strip()
    or os.getenv("POSTMARK_API_TOKEN", "").strip()
)


def _send_verification_link_email(to_email: str, verification_link: str, language: str = "en"):
    """
    Send the single **magic-link** email (Postmark). The URL includes ``?verify=<token>`` and
    ``sid=<user_sessions.id>`` when the client supplied ``user_session_id`` so the browser restores
    the same CHON session (avoids a second session from a fresh intro click).

    **Canonical verified path:** user opens ``/login?verify=<token>`` (and optional ``sid``) → app calls
    ``GET /email/verify/<token>`` → ``email_verifications`` marked verified and
    ``user_sessions.email_verified`` set, then the user completes account creation on ``/login``.

    (A separate legacy path exists: Supabase Auth redirect → ``POST /auth/callback`` after session exchange.)
    """
    if not POSTMARK_SERVER_TOKEN:
        raise RuntimeError(
            "POSTMARK_SERVER_TOKEN is not set; cannot send verification email."
        )

    if (language or "en").lower().startswith("zh"):
        subject = "CHON 魔法链接 — 验证邮箱并创建账号"
        text_body = (
            "请使用下方一次性链接验证邮箱并继续创建 CHON 账号（24 小时内有效）。\n\n"
            f"{verification_link}\n\n"
            "如非本人操作，请忽略此邮件。"
        )
        html = (
            "<p>请<strong>点击以下魔法链接</strong>验证邮箱并继续创建 CHON 账号（24 小时内有效）：</p>"
            f'<p><a href="{verification_link}">{verification_link}</a></p>'
            "<p>打开链接后即可设置密码并完成账号创建。</p>"
            "<p>如非本人操作，请忽略此邮件。</p>"
        )
    else:
        subject = "Your CHON magic link — verify email & create account"
        text_body = (
            "Use the one-time magic link below to verify your email and continue creating your CHON account "
            "(link valid 24 hours).\n\n"
            f"{verification_link}\n\n"
            "Opening the link lets you set a password and finish account creation.\n\n"
            "If you did not request this, you can ignore this email."
        )
        html = (
            "<p><strong>Magic link</strong> — click below to <strong>verify your email</strong> and "
            "continue creating your CHON account (link valid 24 hours):</p>"
            f'<p><a href="{verification_link}">{verification_link}</a></p>'
            "<p>Opening this link lets you set a password and finish account creation.</p>"
            "<p>If you did not request this, you can ignore this email.</p>"
        )

    from_display = (
        f"{EMAIL_FROM_NAME} <{EMAIL_FROM}>"
        if EMAIL_FROM_NAME and EMAIL_FROM
        else EMAIL_FROM
    )
    payload = {
        "From": from_display,
        "To": to_email.strip(),
        "Subject": subject,
        "TextBody": text_body,
        "HtmlBody": html,
        "MessageStream": "outbound",
    }
    req = urllib.request.Request(
        "https://api.postmarkapp.com/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "X-Postmark-Server-Token": POSTMARK_SERVER_TOKEN,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            if resp.status not in (200, 201):
                raise RuntimeError(f"Postmark send failed: HTTP {resp.status} {raw}")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Postmark send failed: HTTP {e.code} {err_body}") from e


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


def _bounded_int(value, field_name: str, minimum: int = 0, maximum: Optional[int] = None) -> int:
    """Convert client numeric fields to DB integer columns, clamping to known bounds."""
    if isinstance(value, bool) or value is None:
        raise ValueError(f"{field_name} must be a number")
    try:
        n = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} must be a number") from exc
    if not math.isfinite(n):
        raise ValueError(f"{field_name} must be finite")

    rounded = int(math.floor(n + 0.5)) if n >= 0 else int(math.ceil(n - 0.5))
    if rounded < minimum:
        return minimum
    if maximum is not None and rounded > maximum:
        return maximum
    return rounded


def mark_email_verification_verified(verification_token=None, record_id=None, questionnaire_type=None):
    """
    Canonical verified write path.
    Always sets BOTH:
      - is_verified = True
      - verified_at = current UTC timestamp
    This keeps future verification behavior consistent across endpoints.

    After UPDATE, re-reads the row. If columns are still unset, the UPDATE matched no row or RLS
    blocked the write (PostgREST often returns 200 with empty body either way).
    """
    if not verification_token and not record_id:
        raise ValueError("mark_email_verification_verified requires verification_token or record_id")

    payload = {
        'is_verified': True,
        'verified_at': datetime.now(timezone.utc).isoformat(),
    }
    if questionnaire_type in VALID_QUESTIONNAIRE_TYPES:
        payload['questionnaire_type'] = questionnaire_type

    query = supabase.table('email_verifications').update(payload)
    if verification_token:
        vt = str(verification_token).strip()
        result = query.eq('verification_token', vt).execute()
        ensure_supabase_ok(result, "mark verified by token")
        chk = supabase.table('email_verifications').select('is_verified, verified_at').eq(
            'verification_token', vt
        ).limit(1).execute()
        ensure_supabase_ok(chk, "mark verified readback")
        if not chk.data:
            raise Exception(
                "mark_email_verification_verified: no email_verifications row for this token "
                "(wrong token or URL encoding)."
            )
        row = chk.data[0]
        if not row.get('is_verified') or row.get('verified_at') in (None, ''):
            raise Exception(
                "mark_email_verification_verified: is_verified/verified_at unchanged after UPDATE. "
                "Typical cause: RLS on email_verifications blocks UPDATE for role anon — extend "
                "database/rls_allow_anon_chon_api.sql (email_verifications + user_sessions) and re-run in Supabase."
            )
    else:
        result = query.eq('id', record_id).execute()
        ensure_supabase_ok(result, "mark verified by id")
        chk = supabase.table('email_verifications').select('is_verified, verified_at').eq(
            'id', record_id
        ).limit(1).execute()
        ensure_supabase_ok(chk, "mark verified readback by id")
        if not chk.data or not chk.data[0].get('is_verified') or chk.data[0].get('verified_at') in (None, ''):
            raise Exception(
                "mark_email_verification_verified: row not verified after UPDATE by id (RLS or missing row)."
            )
    return payload['verified_at']


def find_latest_session_for_verification(email=None, session_token=None):
    """Resolve the most relevant user session for verification sync."""
    # Strongest link: email_verifications.session_token stores user_sessions.id in current flow.
    if session_token:
        by_token = supabase.table('user_sessions').select(
            'id, questionnaire_type'
        ).eq('id', session_token).limit(1).execute()
        ensure_supabase_ok(by_token, "lookup user_session by session_token")
        if by_token.data:
            return by_token.data[0]

    if email:
        normalized = str(email).strip()
        if normalized:
            # Try exact first.
            by_email = supabase.table('user_sessions').select(
                'id, questionnaire_type, email'
            ).eq('email', normalized).order(
                'created_at', desc=True
            ).limit(1).execute()
            ensure_supabase_ok(by_email, "lookup user_session by exact email")
            if by_email.data:
                return by_email.data[0]

            # Fallback for mixed-case stored emails.
            by_email_ci = supabase.table('user_sessions').select(
                'id, questionnaire_type, email'
            ).ilike('email', normalized).order(
                'created_at', desc=True
            ).limit(1).execute()
            ensure_supabase_ok(by_email_ci, "lookup user_session by ilike email")
            if by_email_ci.data:
                return by_email_ci.data[0]

    return None


def find_most_recent_user_session_for_email(email):
    """
    Newest ``user_sessions`` row for this email (``created_at`` desc).
    Tag scores / ``question_responses`` are usually linked to this row, not an older
    session id that may still appear on ``email_verifications.session_token``.
    """
    if not email:
        return None
    normalized = str(email).strip()
    if not normalized:
        return None
    r = supabase.table('user_sessions').select('id, questionnaire_type, email').eq(
        'email', normalized
    ).order('created_at', desc=True).limit(1).execute()
    ensure_supabase_ok(r, 'find_most_recent_user_session_for_email exact')
    if r.data:
        return r.data[0]
    r2 = supabase.table('user_sessions').select('id, questionnaire_type, email').ilike(
        'email', normalized
    ).order('created_at', desc=True).limit(1).execute()
    ensure_supabase_ok(r2, 'find_most_recent_user_session_for_email ilike')
    if r2.data:
        return r2.data[0]
    return None


def _as_uuid_str(val):
    if val is None:
        return None
    try:
        return str(uuid.UUID(str(val).strip()))
    except (ValueError, TypeError):
        return None


def _user_session_row_exists(sid: Optional[str]) -> bool:
    """True if ``user_sessions`` has this primary key (used to validate verification bindings)."""
    if not supabase or not sid:
        return False
    try:
        r = supabase.table('user_sessions').select('id').eq('id', sid).limit(1).execute()
        ensure_supabase_ok(r, 'user_sessions row exists')
        return bool(r.data)
    except Exception:
        return False


def _collect_user_session_ids_for_email_verified(
    *,
    verified_email: str,
    legacy_session_token,
    body_session_id,
    include_most_recent_by_email: bool = True,
):
    """
    CHON session ids that should receive ``email_verified`` for this proof.

    When ``include_most_recent_by_email`` is True (Supabase / legacy paths), also includes the
    newest ``user_sessions`` row for the verified email so older flows still converge.

    When False (Postmark magic-link with a bound ``email_verifications.session_token``), only
    explicit session ids are used so verification does not jump to a different session.
    """
    ids: Set[str] = set()
    ve = str(verified_email or '').strip()
    leg = _as_uuid_str(legacy_session_token)
    if leg:
        ids.add(leg)
    body = _as_uuid_str(body_session_id)
    if body:
        ids.add(body)
    if include_most_recent_by_email and ve:
        mr = find_most_recent_user_session_for_email(ve)
        if mr and mr.get('id'):
            ids.add(str(mr['id']))
    return ids


def _apply_email_verified_to_user_sessions(*, verified_email: str, session_ids: Set[str]):
    """Set ``email_verified`` and normalize ``email`` on each session id."""
    ve = str(verified_email or '').strip()
    if not ve or not session_ids:
        return
    patch = {'email_verified': True, 'email': ve}
    applied = 0
    for sid in session_ids:
        if not sid:
            continue
        if not _user_session_row_exists(str(sid)):
            print(f'Warning: _apply_email_verified_to_user_sessions skip missing user_sessions.id={sid}')
            continue
        up = supabase.table('user_sessions').update(patch).eq('id', sid).execute()
        ensure_supabase_ok(up, f'user_sessions email_verified {sid}')
        rd = supabase.table('user_sessions').select('email_verified').eq('id', sid).limit(1).execute()
        ensure_supabase_ok(rd, f'user_sessions email_verified readback {sid}')
        if not rd.data or not rd.data[0].get('email_verified'):
            raise Exception(
                f'user_sessions.email_verified still false for id={sid} after UPDATE. '
                'Typical cause: RLS on user_sessions blocks UPDATE for role anon — extend '
                'database/rls_allow_anon_chon_api.sql and re-run in Supabase.'
            )
        applied += 1
    if applied == 0:
        raise Exception(
            '_apply_email_verified_to_user_sessions: no matching user_sessions rows for supplied ids '
            f'(session_ids={sorted(session_ids)}). email_verified was not updated.'
        )


# --- question_responses: use user_session_ids (UUID[]) only; there is no user_session_id column.
# Do not reintroduce that column in app code. DB views must not SELECT the old column or
# DROP COLUMN will fail (see database/migrate_question_responses_drop_user_session_id.sql).
AGGREGATE_QUESTION_TYPES = frozenset({
    'scale-question', 'multiple-choice', 'multi-select', 'searchable-dropdown',
})
VALID_QUESTIONNAIRE_TYPES = frozenset({'mother', 'corporate', 'other', 'both'})


def _normalize_aggregate_response_value(question_type: str, response_value):
    """
    Match DB VARCHAR storage and partial unique index ``uq_question_responses_aggregate_answer``:
    same logical answer must compare equal on select/insert (e.g. JSON number 3 vs '3').
    """
    if response_value is None:
        return None
    if question_type == 'scale-question':
        return str(response_value).strip()
    s = str(response_value).strip()
    if question_type in ('multiple-choice', 'searchable-dropdown') and len(s) == 1:
        return s.upper()
    return s

# In-process buffer: payloads seen immediately before Supabase writes (not persisted; lost on restart).
# Enable with CHON_PRE_SUPABASE_CAPTURE=1. Max entries: CHON_PRE_SUPABASE_CAPTURE_MAX (default 50000).
_PRE_SUPABASE_CAPTURE_LOCK = threading.Lock()
_PRE_SUPABASE_ANSWERS_CAPTURE = []
_PRE_SUPABASE_CAPTURE_MAX = int(os.getenv('CHON_PRE_SUPABASE_CAPTURE_MAX', '50000'))


def _pre_supabase_capture_enabled():
    return os.getenv('CHON_PRE_SUPABASE_CAPTURE', '').lower() in ('1', 'true', 'yes')


def _capture_pre_supabase(source: str, user_session_id, payload: dict):
    """Record one logical write right before it hits Supabase."""
    if not _pre_supabase_capture_enabled():
        return
    rec = {
        'at': datetime.now(timezone.utc).isoformat(),
        'source': source,
        'user_session_id': user_session_id,
        'payload': payload,
    }
    with _PRE_SUPABASE_CAPTURE_LOCK:
        _PRE_SUPABASE_ANSWERS_CAPTURE.append(rec)
        if len(_PRE_SUPABASE_ANSWERS_CAPTURE) > _PRE_SUPABASE_CAPTURE_MAX:
            del _PRE_SUPABASE_ANSWERS_CAPTURE[: len(_PRE_SUPABASE_ANSWERS_CAPTURE) - _PRE_SUPABASE_CAPTURE_MAX]

# --- Full tag statistics row set (must match frontend CHINESE_TAGS / tagUtils) ---
EXPECTED_TAG_STATISTICS_TAGS = frozenset({
    'selfAwareness', 'dedication', 'socialIntelligence',
    'emotionalRegulation', 'objectivity', 'coreEndurance',
})

# English → Chinese keys (must match frontend `tagUtils.TAG_MAPPING`)
_TAG_EN_TO_ZH = {
    'selfAwareness': '自我意识',
    'dedication': '奉献精神',
    'socialIntelligence': '社交情商',
    'emotionalRegulation': '情绪调节',
    'objectivity': '客观能力',
    'coreEndurance': '核心耐力',
}

EXPECTED_CHARACTER_IDS = frozenset({
    'odin', 'wukong', 'prometheus', 'nuwa', 'athena', 'venus',
})

# Unified Q25 is a normal multiple-choice answer stored in question_responses (same as other MC).
# tag_statistics.question_25_bonus_* and character_matches.question_25_answer are denormalized from
# that answer for reporting / UI — they are not separate sources of truth.
Q25_ANSWER_TO_TAG = {
    'A': 'dedication',
    'B': 'emotionalRegulation',
    'C': 'selfAwareness',
    'D': 'socialIntelligence',
    'E': 'coreEndurance',
    'F': 'objectivity',
}

# Last-question local id per flow (unified question 25); aggregate rows may omit these.
Q25_FINAL_QUESTION_ID_BY_TYPE = {
    'mother': 'mother_33',
    'corporate': 'corporate_33',
    'other': 'other_29',
    'both': 'both_45',
}


def _dominant_questionnaire_type_from_responses(responses) -> Optional[str]:
    """Most common questionnaire_type in a batch payload (fixes wrong DB default 'mother')."""
    if not responses:
        return None
    counts = {}
    for r in responses:
        if not isinstance(r, dict):
            continue
        qt = r.get('questionnaire_type')
        if qt in VALID_QUESTIONNAIRE_TYPES:
            counts[qt] = counts.get(qt, 0) + 1
    if not counts:
        return None
    return max(counts.items(), key=lambda x: x[1])[0]


def _session_questionnaire_type(user_session_id: str) -> Optional[str]:
    if not supabase or not user_session_id:
        return None
    try:
        r = supabase.table('user_sessions').select('questionnaire_type').eq(
            'id', user_session_id
        ).limit(1).execute()
        ensure_supabase_ok(r, 'session questionnaire_type lookup')
        if r.data:
            qt = r.data[0].get('questionnaire_type')
            if qt in VALID_QUESTIONNAIRE_TYPES:
                return qt
    except Exception as err:
        print(f"Warning: session questionnaire_type lookup: {err}")
    return None


def _response_unified_int(response: dict) -> Optional[int]:
    u = response.get('unified_question_id', response.get('original_question_id'))
    try:
        return int(u) if u is not None and str(u).strip() != '' else None
    except (ValueError, TypeError):
        return None


def _apply_identity_questionnaire_type_to_responses(responses: list, forced_qt: str) -> None:
    """Force questionnaire_type and Q25 question_id to match the identity-driven flow."""
    if forced_qt not in VALID_QUESTIONNAIRE_TYPES or not responses:
        return
    final_qid = Q25_FINAL_QUESTION_ID_BY_TYPE[forced_qt]
    for r in responses:
        if not isinstance(r, dict):
            continue
        r['questionnaire_type'] = forced_qt
        uid = _response_unified_int(r)
        if uid == 25 and r.get('question_type') in AGGREGATE_QUESTION_TYPES:
            r['question_id'] = final_qid
            r['unified_question_id'] = 25


def _dedupe_q25_responses_in_place(responses: list) -> None:
    """If the client sent multiple unified-Q25 rows, keep only the last (same save batch)."""
    if not responses:
        return
    idxs = []
    for i, r in enumerate(responses):
        if not isinstance(r, dict):
            continue
        if r.get('question_type') not in AGGREGATE_QUESTION_TYPES:
            continue
        if _response_unified_int(r) == 25:
            idxs.append(i)
    if len(idxs) <= 1:
        return
    for i in reversed(idxs[:-1]):
        responses.pop(i)


def _delete_mismatched_q25_session_rows(user_session_id: str, canonical_qt: str) -> None:
    """
    Remove per-session Q25-shaped rows that do not match the canonical flow (e.g. mother_33
    when the user completed ``other`` with other_29). Only touches rows whose user_session_ids
    is a single-element array [this session] to avoid aggregate rows with many sessions.
    """
    if not supabase or not user_session_id or canonical_qt not in Q25_FINAL_QUESTION_ID_BY_TYPE:
        return
    expected_qid = Q25_FINAL_QUESTION_ID_BY_TYPE[canonical_qt]
    try:
        res = supabase.table('question_responses').select(
            'id, questionnaire_type, question_id, original_question_id, question_type, '
            'is_text_response, user_session_ids'
        ).contains('user_session_ids', [user_session_id]).execute()
        ensure_supabase_ok(res, 'q25 scrub select')
        for row in res.data or []:
            if row.get('is_text_response'):
                continue
            if row.get('question_type') != 'multiple-choice':
                continue
            sids = row.get('user_session_ids') or []
            if len(sids) != 1 or str(sids[0]) != str(user_session_id):
                continue
            if not _is_question_25_response_row(row):
                continue
            if row.get('questionnaire_type') == canonical_qt and str(row.get('question_id') or '') == expected_qid:
                continue
            rid = row.get('id')
            if rid is not None:
                supabase.table('question_responses').delete().eq('id', rid).execute()
    except Exception as err:
        print(f"Warning: q25 scrub failed: {err}")


def _normalize_q25_choice(response_value, response_text):
    """Return 'A'..'F' from stored question_responses fields, or None."""
    for raw in (response_value, response_text):
        if raw is None:
            continue
        s = str(raw).strip().upper()
        if not s:
            continue
        ch = s[0]
        if ch in Q25_ANSWER_TO_TAG:
            return ch
    return None


def _is_question_25_response_row(row: dict) -> bool:
    """
    Unified Q25 is the last multiple-choice in each questionnaire; stored rows may use
    original_question_id = 25, or legacy local indices (33/29/45), or question_id
    mother_33 / corporate_33 / other_29 / both_45 (see questionnaires.ts).
    """
    if row.get('question_type') != 'multiple-choice' or row.get('is_text_response'):
        return False
    oid = row.get('original_question_id')
    qid = str(row.get('question_id') or '')
    qt = row.get('questionnaire_type')
    if qid in ('mother_33', 'corporate_33', 'other_29', 'both_45'):
        return True
    if oid == 25:
        return True
    if qt == 'mother' and oid == 33:
        return True
    if qt == 'corporate' and oid == 33:
        return True
    if qt == 'other' and oid == 29:
        return True
    if qt == 'both' and oid == 45:
        return True
    return False


def _ensure_per_session_question_25_row(
    user_session_id: str,
    responses: list,
    preferred_questionnaire_type: Optional[str] = None,
) -> None:
    """
    Persist one canonical Q25 row per session (user_session_ids = [session] only).

    Letter resolution order:
      1) In-memory ``responses`` from the same request (batch / single save).
      2) Else the latest Q25-shaped row already in ``question_responses`` for this
         session (covers aggregate MC rows written just before this call).

    ``preferred_questionnaire_type`` should match the batch (e.g. ``other``) so we do not
    insert ``mother_33`` when ``user_sessions.questionnaire_type`` was still null/mother.

    Does not read character_matches or tag_statistics.
    """
    if not supabase or not user_session_id:
        return
    if responses is None:
        responses = []

    if preferred_questionnaire_type in VALID_QUESTIONNAIRE_TYPES:
        questionnaire_type = preferred_questionnaire_type
    else:
        questionnaire_type = (
            _dominant_questionnaire_type_from_responses(responses)
            or resolve_questionnaire_type(None, user_session_id=user_session_id)
        )
    if questionnaire_type not in Q25_FINAL_QUESTION_ID_BY_TYPE:
        return

    final_question_id = Q25_FINAL_QUESTION_ID_BY_TYPE[questionnaire_type]
    choice = None
    for r in responses:
        if not isinstance(r, dict):
            continue
        uid = r.get('unified_question_id', r.get('original_question_id'))
        try:
            oid = int(uid) if uid is not None and str(uid).strip() != '' else None
        except (ValueError, TypeError):
            oid = None
        rqt = resolve_questionnaire_type(
            r.get('questionnaire_type'),
            user_session_id=user_session_id,
        )
        synth = {
            'questionnaire_type': rqt,
            'question_id': str(r.get('question_id') or ''),
            'original_question_id': oid,
            'question_type': r.get('question_type'),
            'is_text_response': bool(r.get('is_text_response', False)),
        }
        if not _is_question_25_response_row(synth):
            continue
        ch = _normalize_q25_choice(r.get('response_value'), r.get('response_text'))
        if ch:
            choice = ch
            break

    if not choice:
        choice = fetch_question_25_choice_for_session(user_session_id)

    if not choice:
        return

    existing = supabase.table('question_responses').select('id, response_value').contains(
        'user_session_ids', [user_session_id]
    ).eq('question_id', final_question_id).eq(
        'original_question_id', 25
    ).eq('question_type', 'multiple-choice').eq(
        'is_text_response', False
    ).limit(5).execute()
    ensure_supabase_ok(existing, 'per-session Q25 lookup')

    now_iso = datetime.now(timezone.utc).isoformat()
    rows = existing.data or []
    if rows:
        rid = rows[0].get('id')
        if rid is not None and rows[0].get('response_value') != choice:
            q25_update = {
                'response_value': choice,
                'response_text': choice,
                'updated_at': now_iso,
            }
            _capture_pre_supabase('_ensure_per_session_question_25_row_update', user_session_id, {
                'question_response_id': rid,
                'patch': q25_update,
            })
            up = supabase.table('question_responses').update(q25_update).eq('id', rid).execute()
            ensure_supabase_ok(up, 'per-session Q25 update')
        return

    q25_insert = {
        'questionnaire_type': questionnaire_type,
        'question_id': final_question_id,
        'original_question_id': 25,
        'question_type': 'multiple-choice',
        'response_value': choice,
        'response_text': choice,
        'is_text_response': False,
        'user_session_ids': [user_session_id],
    }
    _capture_pre_supabase('_ensure_per_session_question_25_row_insert', user_session_id, q25_insert)
    ins = supabase.table('question_responses').insert(q25_insert).execute()
    ensure_supabase_ok(ins, 'per-session Q25 insert')


def fetch_question_25_choice_for_session(user_session_id: str):
    """
    Latest Q25 multiple-choice (A–F) for this session from question_responses.
    Uses response_value first, then response_text (covers edge storage shapes).
    """
    if not supabase or not user_session_id:
        return None
    base = supabase.table('question_responses').select(
        'response_value, response_text, original_question_id, question_id, questionnaire_type, question_type, is_text_response, updated_at, created_at'
    ).eq(
        'is_text_response', False
    ).eq(
        'question_type', 'multiple-choice'
    ).contains(
        'user_session_ids', [user_session_id]
    ).in_(
        'original_question_id', [25, 29, 33, 45]
    ).order('updated_at', desc=True).limit(50).execute()
    ensure_supabase_ok(base, "question 25 lookup (candidate ids)")
    rows = [r for r in (base.data or []) if _is_question_25_response_row(r)]
    if not rows:
        # Rows stored only under question_id (e.g. aggregate shape) without matching oids above
        by_qid = supabase.table('question_responses').select(
            'response_value, response_text, original_question_id, question_id, questionnaire_type, question_type, is_text_response, updated_at, created_at'
        ).eq('is_text_response', False).eq('question_type', 'multiple-choice').contains(
            'user_session_ids', [user_session_id]
        ).in_(
            'question_id', [
                'mother_33', 'corporate_33', 'other_29', 'both_45',
                'mother_unified_25', 'corporate_unified_25', 'other_unified_25', 'both_unified_25',
            ]
        ).order('updated_at', desc=True).limit(20).execute()
        ensure_supabase_ok(by_qid, "question 25 lookup by question_id")
        rows = [r for r in (by_qid.data or []) if _is_question_25_response_row(r)]

    session_qt = _session_questionnaire_type(user_session_id)
    if session_qt and rows:
        filtered = [r for r in rows if r.get('questionnaire_type') == session_qt]
        if filtered:
            rows = filtered

    if not rows:
        return None
    rows.sort(key=lambda r: (str(r.get('updated_at') or ''), str(r.get('created_at') or '')), reverse=True)
    row = rows[0]
    return _normalize_q25_choice(row.get('response_value'), row.get('response_text'))


def resolve_questionnaire_type(payload_questionnaire_type=None, user_session_id=None, email=None, fallback='mother'):
    """
    Resolve questionnaire_type for writes. Identity (``user_sessions.questionnaire_type``)
    wins when set so all rows align with the user's chosen path (mother/corporate/other/both).
    """
    try:
        if user_session_id:
            sq = _session_questionnaire_type(user_session_id)
            if sq in VALID_QUESTIONNAIRE_TYPES:
                return sq
    except Exception as err:
        print(f"Warning: resolve_questionnaire_type session lookup: {err}")

    if payload_questionnaire_type in VALID_QUESTIONNAIRE_TYPES:
        return payload_questionnaire_type

    try:
        if email:
            by_email = supabase.table('user_sessions').select(
                'questionnaire_type'
            ).eq('email', email).order('created_at', desc=True).limit(1).execute()
            ensure_supabase_ok(by_email, "resolve_questionnaire_type by email")
            if by_email.data:
                qtype = by_email.data[0].get('questionnaire_type')
                if qtype in VALID_QUESTIONNAIRE_TYPES:
                    return qtype
    except Exception as err:
        print(f"Warning: failed questionnaire_type resolution: {err}")

    return fallback


def upsert_text_question_response(
    questionnaire_type,
    question_id,
    original_question_id,
    question_type,
    response_text,
    user_session_id=None,
):
    """One row per (questionnaire, question, session) for text; session stored in user_session_ids."""
    qid = str(question_id)
    oid = int(original_question_id)
    row = {
        'questionnaire_type': questionnaire_type,
        'question_id': qid,
        'original_question_id': oid,
        'question_type': question_type,
        'response_text': response_text,
        'is_text_response': True,
        'user_session_ids': [user_session_id] if user_session_id else [],
    }
    _capture_pre_supabase('upsert_text_question_response', user_session_id, dict(row))
    if not user_session_id:
        ins = supabase.table('question_responses').insert(row).execute()
        ensure_supabase_ok(ins, "text question_responses insert")
        return
    existing = supabase.table('question_responses').select('id').eq(
        'questionnaire_type', questionnaire_type
    ).eq('question_id', qid).eq(
        'original_question_id', oid
    ).eq('is_text_response', True).contains(
        'user_session_ids', [user_session_id]
    ).order('created_at', desc=True).limit(1).execute()
    ensure_supabase_ok(existing, "text question_responses select")
    if existing.data:
        up = supabase.table('question_responses').update({
            'response_text': response_text,
            'updated_at': datetime.now(timezone.utc).isoformat(),
        }).eq('id', existing.data[0]['id']).execute()
        ensure_supabase_ok(up, "text question_responses update")
    else:
        ins = supabase.table('question_responses').insert(row).execute()
        ensure_supabase_ok(ins, "text question_responses insert")


def upsert_aggregate_choice_response(
    questionnaire_type,
    question_id,
    original_question_id,
    question_type,
    response_value,
    user_session_id=None,
):
    """
    Session-shaped write for choice-like rows. This keeps one row per
    (questionnaire_type, question_id, original_question_id, question_type, response_value, session)
    and does not merge counts across sessions.
    """
    if question_type not in AGGREGATE_QUESTION_TYPES:
        return False
    qid = str(question_id)
    oid = int(original_question_id)
    rv = _normalize_aggregate_response_value(question_type, response_value)
    _capture_pre_supabase('upsert_aggregate_choice_response', user_session_id, {
        'questionnaire_type': questionnaire_type,
        'question_id': qid,
        'original_question_id': oid,
        'question_type': question_type,
        'response_value': rv,
    })
    session_ids = [user_session_id] if user_session_id else []
    row = {
        'questionnaire_type': questionnaire_type,
        'question_id': qid,
        'original_question_id': oid,
        'question_type': question_type,
        'response_value': rv,
        'is_text_response': False,
        'count': 1,
        'user_session_ids': session_ids,
    }
    if not user_session_id:
        ins = supabase.table('question_responses').insert(row).execute()
        ensure_supabase_ok(ins, "choice question_responses insert (no session)")
        return True
    existing = supabase.table('question_responses').select('id').eq(
        'questionnaire_type', questionnaire_type
    ).eq('question_id', qid).eq(
        'original_question_id', oid
    ).eq('question_type', question_type).eq(
        'response_value', rv
    ).eq(
        'is_text_response', False
    ).contains(
        'user_session_ids', [user_session_id]
    ).limit(1).execute()
    ensure_supabase_ok(existing, "choice question_responses select")
    if existing.data:
        # Idempotent replay for same session + same answer.
        return True
    ins = supabase.table('question_responses').insert(row).execute()
    ensure_supabase_ok(ins, "choice question_responses insert")
    return True


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
    Increment aggregate intro yes/no counts in ``intro_choices`` (historical totals).
    Deployments must not truncate this table; only POST here and GET /intro-stats read it.
    Expects JSON: {"choice": "yes"} or {"choice": "no"}
    """
    data = request.get_json()
    choice = data.get('choice')
    
    if choice not in ['yes', 'no']:
        return jsonify({'error': 'Invalid choice. Must be "yes" or "no"'}), 400
    
    try:
        current = supabase.table('intro_choices').select('count').eq('choice', choice).execute()
        ensure_supabase_ok(current, "Failed to read intro choice")
        if current.data:
            count = (current.data[0].get('count') or 0) + 1
            update_result = supabase.table('intro_choices').update({"count": count}).eq('choice', choice).execute()
            ensure_supabase_ok(update_result, "Failed to update intro choice")
        else:
            insert_result = supabase.table('intro_choices').insert({"choice": choice, "count": 1}).execute()
            ensure_supabase_ok(insert_result, "Failed to insert intro choice")
        
        return jsonify({'success': True, 'message': f'Successfully incremented count for {choice}'})
    
    except Exception as e:
        print(f"Error updating intro choice: {e}")
        return jsonify({'error': str(e)}), 500

@application.route('/intro-stats', methods=['GET'])
@require_database
def get_intro_stats():
    try:
        response = supabase.table('intro_choices').select('*').execute()
        
        choices_data = response.data
        
        yes_count = 0
        no_count = 0
        
        for item in choices_data:
            if item['choice'] == 'yes':
                yes_count = item['count']
            elif item['choice'] == 'no':
                no_count = item['count']
        
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
            'yes_percentage': 50,  
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
    required_fields = ['question_id', 'question_type', 'response_value']
    missing_fields = [field for field in required_fields if field not in data]
    
    if missing_fields:
        return jsonify({"error": f"Missing required fields: {', '.join(missing_fields)}"}), 400
    
    # Extract data
    user_session_id = data.get('user_session_id')
    questionnaire_type = resolve_questionnaire_type(
        data.get('questionnaire_type'),
        user_session_id=user_session_id,
    )
    question_id = str(data['question_id'])  # 确保以字符串形式存储
    unified_question_id = data.get('unified_question_id', data.get('original_question_id'))
    if unified_question_id is None:
        return jsonify({"error": "Missing required field: unified_question_id"}), 400
    original_question_id = int(unified_question_id)  # 统一问题ID
    question_type = data['question_type']
    response_value = data['response_value']
    if (
        questionnaire_type in VALID_QUESTIONNAIRE_TYPES
        and question_type in AGGREGATE_QUESTION_TYPES
        and original_question_id == 25
    ):
        question_id = str(Q25_FINAL_QUESTION_ID_BY_TYPE[questionnaire_type])
    data['questionnaire_type'] = questionnaire_type
    data['question_id'] = question_id
    data['unified_question_id'] = original_question_id
    
    try:
        _capture_pre_supabase('store_question_response', user_session_id, {
            'questionnaire_type': questionnaire_type,
            'question_id': question_id,
            'original_question_id': original_question_id,
            'question_type': question_type,
            'response_value': response_value,
            'raw': data,
        })
        # For scale questions and choice-based questions, we track aggregate counts
        # (one row per questionnaire_type, question_id, original_question_id, response_value).
        if question_type in AGGREGATE_QUESTION_TYPES:
            upsert_aggregate_choice_response(
                questionnaire_type, question_id, original_question_id, question_type, response_value, user_session_id
            )
            if user_session_id and question_type == 'multiple-choice':
                _ensure_per_session_question_25_row(
                    user_session_id, [data], questionnaire_type
                )
            return jsonify({"message": "Question response stored successfully"}), 200
        
        # For text inputs, store in question_responses with is_text_response flag
        elif question_type in ['text-input', 'text-with-unit', 'email']:
            upsert_text_question_response(
                questionnaire_type,
                question_id,
                original_question_id,
                question_type,
                response_value,
                user_session_id,
            )
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
                "unified_question_id": 1,  # 统一问题ID
                "question_type": "multiple-choice",
                "response_value": "A"
            },
            ... 更多回答 ...
        ]
    }
    """
    data = request.get_json(silent=True) or {}
    responses = data.get('responses', [])
    
    if not responses:
        return jsonify({'error': 'No responses provided'}), 400
    
    # Get user_session_id from request if provided
    user_session_id = data.get('user_session_id')
    dominant = _dominant_questionnaire_type_from_responses(responses)
    forced_qt = resolve_questionnaire_type(dominant, user_session_id=user_session_id)
    if forced_qt in VALID_QUESTIONNAIRE_TYPES:
        _apply_identity_questionnaire_type_to_responses(responses, forced_qt)
    _dedupe_q25_responses_in_place(responses)

    try:
        _capture_pre_supabase('batch_save_question_responses', user_session_id, {
            'responses': responses,
            'response_count': len(responses),
        })
        # 使用Supabase批量插入/更新
        for response in responses:
            # 确保question_id以字符串形式存储
            question_id = str(response.get('question_id'))
            unified_question_id = response.get('unified_question_id', response.get('original_question_id'))
            if unified_question_id is None:
                return jsonify({'error': 'Missing unified_question_id in responses'}), 400
            original_question_id = int(unified_question_id)
            
            question_type = response.get('question_type')
            
            response_data = {
                'questionnaire_type': response.get('questionnaire_type'),
                'question_id': question_id,
                'original_question_id': original_question_id,
                'question_type': question_type
            }
            
            # Handle text vs other response types
            if question_type in ['text-input', 'text-with-unit', 'email']:
                response_data['response_text'] = response.get('response_value')
                response_data['is_text_response'] = True
            else:
                response_data['response_value'] = response.get('response_value')
                response_data['is_text_response'] = False

            if question_type in AGGREGATE_QUESTION_TYPES:
                rv = response.get('response_value')
                upsert_aggregate_choice_response(
                    resolve_questionnaire_type(
                        response_data.get('questionnaire_type'),
                        user_session_id=user_session_id,
                    ),
                    question_id,
                    original_question_id,
                    question_type,
                    rv,
                    user_session_id,
                )
                continue

            if question_type in ['text-input', 'text-with-unit', 'email']:
                upsert_text_question_response(
                    resolve_questionnaire_type(
                        response_data.get('questionnaire_type'),
                        user_session_id=user_session_id,
                    ),
                    question_id,
                    original_question_id,
                    question_type,
                    response.get('response_value'),
                    user_session_id,
                )
                continue

            response_data['questionnaire_type'] = resolve_questionnaire_type(
                response_data.get('questionnaire_type'),
                user_session_id=user_session_id,
            )
            if user_session_id:
                response_data['user_session_ids'] = [user_session_id]
            else:
                response_data['user_session_ids'] = []
            _capture_pre_supabase('batch_question_responses_direct_insert', user_session_id, response_data)
            result = supabase.table('question_responses').insert(response_data).execute()
            ensure_supabase_ok(result, "Failed to save batch question response")

        if user_session_id:
            canonical_qt = forced_qt if forced_qt in VALID_QUESTIONNAIRE_TYPES else None
            pref = canonical_qt
            if pref:
                try:
                    supabase.table('user_sessions').update({
                        'questionnaire_type': pref,
                    }).eq('id', user_session_id).execute()
                except Exception as sync_qt_err:
                    print(f"Warning: could not sync user_sessions.questionnaire_type: {sync_qt_err}")
                _delete_mismatched_q25_session_rows(user_session_id, pref)
            _ensure_per_session_question_25_row(user_session_id, responses, pref)
            # Second pass: aggregate MC rows for Q25 are written in-loop; re-read from DB so
            # canonical oid=25 row is inserted even if the first pass missed in-memory shape.
            _ensure_per_session_question_25_row(user_session_id, [], pref)

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

def _expire_unverified_email_verifications_for_email(email: str) -> None:
    """Set past expiry on pending rows so each send keeps one live token family per address."""
    ve = str(email or '').strip()
    if not ve:
        return
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        exp = supabase.table('email_verifications').update({
            'expires_at': now_iso,
        }).eq('email', ve).eq('is_verified', False).execute()
        ensure_supabase_ok(exp, "email_verifications expire unverified by email")
    except Exception as ex:
        print(f"Warning: expire unverified email_verifications for {ve}: {ex}")


@application.route('/email/send-verification', methods=['POST'])
@require_database
def send_verification_email():
    """
    Send the **magic-link** email via **Postmark** (CHON API) for **account creation** after the
    personality test. Link targets ``/login?verify=<token>&mode=register`` and may include
    ``sid=<user_sessions.id>``.

    When Postmark is unavailable the client falls back to **Supabase** ``signInWithOtp`` (magic link via
    ``/auth/callback?sid=...``); completing that link uses ``POST /auth/callback`` to set the same fields.

    Each call **inserts** a new ``email_verifications`` row and expires prior unverified rows for that
    email. When ``user_session_id`` is present, also writes ``user_sessions.email`` so the session row
    matches what the user typed even if the client PATCH failed.

    Expects JSON: {"email": "...", "language": "en"|"zh", "user_session_id": "...", "questionnaire_type": "..."}
    """
    data = request.get_json()
    email = data.get('email')
    language = data.get('language', 'en')
    user_session_id = data.get('user_session_id')
    questionnaire_type = resolve_questionnaire_type(
        data.get('questionnaire_type'),
        user_session_id=user_session_id,
        email=email,
    )
    
    if not email:
        return jsonify({"error": "Email is required"}), 400

    if not user_session_id:
        return jsonify({"error": "user_session_id is required"}), 400
    
    # Basic email validation
    if '@' not in email or '.' not in email.split('@')[1]:
        return jsonify({"error": "Invalid email format"}), 400
    
    try:
        email_clean = str(email).strip().lower()
        chon_sid = _as_uuid_str(user_session_id)
        if not chon_sid or not _user_session_row_exists(chon_sid):
            return jsonify({"error": "User session not found"}), 404

        existing = supabase.table('user_accounts').select('id').eq('email', email_clean).limit(1).execute()
        ensure_supabase_ok(existing, 'send_verification check existing account')
        if existing.data:
            return jsonify({
                "error": "Account already exists for this email",
                "code": "ACCOUNT_EXISTS",
            }), 409

        try:
            up_em = supabase.table('user_sessions').update({
                'email': email_clean,
            }).eq('id', chon_sid).execute()
            ensure_supabase_ok(up_em, 'send_verification patch user_sessions.email')
        except Exception as patch_err:
            print(f'Warning: send_verification could not patch user_sessions.email: {patch_err}')

        # Generate unique verification token
        verification_token = str(uuid.uuid4())
        session_token = chon_sid if chon_sid else str(uuid.uuid4())
        
        # Calculate expiration (24 hours from now)
        expires_at = datetime.utcnow() + timedelta(hours=24)

        # Always insert a new row; expire prior pending rows for this address (never update verified rows).
        _expire_unverified_email_verifications_for_email(email_clean)

        email_verification_data = {
            'email': email_clean,
            'verification_token': verification_token,
            'session_token': session_token,
            'expires_at': expires_at.isoformat(),
            'is_verified': False,
            'questionnaire_type': questionnaire_type
        }
        ins = supabase.table('email_verifications').insert(email_verification_data).execute()
        ensure_supabase_ok(ins, "email_verifications send insert")

        link_qs = {'verify': verification_token, 'mode': 'register'}
        if chon_sid:
            link_qs['sid'] = chon_sid
        verification_link = f"{FRONTEND_URL}/login?{urlencode(link_qs)}"
        try:
            _send_verification_link_email(email_clean, verification_link, language)
        except Exception as mail_err:
            print(f"Postmark verification email failed: {mail_err}")
            return jsonify({
                "success": False,
                "error": str(mail_err),
            }), 503

        return jsonify({
            "success": True,
            "message": "Verification email sent",
            "verificationToken": verification_token
        }), 200
        
    except Exception as e:
        print(f"Error sending verification email: {str(e)}")
        return jsonify({"error": str(e)}), 500

@application.route('/email/verify/<token>', methods=['GET'])
@require_database
def verify_email_token(token):
    """
    **Primary verification handler** for the Postmark magic-link flow (account creation on ``/login``).

    - Marks ``email_verifications`` verified (``is_verified``, ``verified_at``) via
      ``mark_email_verification_verified``.
    - Sets ``user_sessions.email_verified`` / ``email`` on the **CHON session bound to this token**
      (``email_verifications.session_token``), not on an unrelated "newest session for address".
    - Optional ``?sid=`` is accepted for diagnostics; if it disagrees with the bound session id, it is
      ignored so a crafted query cannot migrate verification to another row.

    Legacy: email can also be marked verified via ``POST /auth/callback`` after a Supabase Auth redirect.
    """
    try:
        token = str(token or '').strip()
        result = supabase.table('email_verifications').select('*').eq('verification_token', token).execute()

        if not result.data:
            return jsonify({"error": "Invalid verification token"}), 400

        record = result.data[0]

        def _questionnaire_type_for_email_verification_row(sess, rec):
            """Prefer live user_sessions row (identity), then stored row, then resolver."""
            if sess:
                qt0 = sess.get('questionnaire_type')
                if qt0 in VALID_QUESTIONNAIRE_TYPES:
                    return qt0
            qt1 = rec.get('questionnaire_type')
            if qt1 in VALID_QUESTIONNAIRE_TYPES:
                return qt1
            return resolve_questionnaire_type(
                rec.get('questionnaire_type'),
                user_session_id=rec.get('session_token'),
                email=rec.get('email'),
            )

        verified_email = (record.get('email') or '').strip()
        query_sid = _as_uuid_str(request.args.get('sid'))
        bound_sid = _as_uuid_str(record.get('session_token'))
        bound_ok = bool(bound_sid and _user_session_row_exists(bound_sid))
        query_ok = bool(query_sid and _user_session_row_exists(query_sid))

        def _resolve_sess_for_qt():
            st = bound_sid if bound_ok else (query_sid if query_ok else None)
            return find_latest_session_for_verification(
                email=record.get('email'),
                session_token=st,
            )

        def _out_session_token():
            if bound_ok:
                return str(bound_sid)
            if query_ok:
                return str(query_sid)
            mr = find_most_recent_user_session_for_email(verified_email)
            if mr and mr.get('id'):
                return str(mr['id'])
            return str(bound_sid) if bound_sid else ''

        def _sid_set_for_apply():
            if bound_ok:
                if query_sid and query_sid != bound_sid:
                    print(
                        'Warning: verify email sid query ignored (mismatch with email_verifications.session_token)',
                    )
                return {str(bound_sid)}
            if query_ok:
                return {str(query_sid)}
            return _collect_user_session_ids_for_email_verified(
                verified_email=verified_email,
                legacy_session_token=record.get('session_token'),
                body_session_id=None,
                include_most_recent_by_email=True,
            )

        # Check if already verified
        if record['is_verified']:
            # On link click, always re-assert verified flags and refresh verified_at timestamp.
            sess_for_qt = _resolve_sess_for_qt()
            qt_fix = _questionnaire_type_for_email_verification_row(sess_for_qt, record)
            mark_email_verification_verified(
                verification_token=token,
                questionnaire_type=qt_fix,
            )
            sid_set = _sid_set_for_apply()
            _apply_email_verified_to_user_sessions(verified_email=verified_email, session_ids=sid_set)
            return jsonify({
                "success": True,
                "message": "Email already verified",
                "sessionToken": _out_session_token(),
                "email": record['email'],
            }), 200

        # Check if expired
        expires_raw = str(record['expires_at'])
        expires_at = datetime.fromisoformat(expires_raw.replace('Z', '+00:00'))
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_at:
            return jsonify({"error": "Verification token has expired"}), 400

        sess_for_qt = _resolve_sess_for_qt()
        resolved_questionnaire_type = _questionnaire_type_for_email_verification_row(sess_for_qt, record)
        mark_email_verification_verified(
            verification_token=token,
            questionnaire_type=resolved_questionnaire_type,
        )

        sid_set = _sid_set_for_apply()
        _apply_email_verified_to_user_sessions(verified_email=verified_email, session_ids=sid_set)

        return jsonify({
            "success": True,
            "message": "Email verified successfully. You can now create your account.",
            "sessionToken": _out_session_token(),
            "email": record['email'],
        }), 200

    except Exception as e:
        print(f"Error verifying email token: {str(e)}")
        return jsonify({"error": str(e)}), 500

@application.route('/email/resend-verification', methods=['POST'])
@require_database
def resend_verification_email():
    """
    Resend account-creation verification email (same link shape as send-verification).
    Expects JSON: {"email": "...", "language": "en", "user_session_id": "...", "questionnaire_type": "..."}
    """
    data = request.get_json()
    email = data.get('email')
    language = data.get('language', 'en')
    user_session_id = data.get('user_session_id')
    questionnaire_type = resolve_questionnaire_type(
        data.get('questionnaire_type'),
        user_session_id=user_session_id,
        email=email,
    )
    
    if not email:
        return jsonify({"error": "Email is required"}), 400

    if not user_session_id:
        return jsonify({"error": "user_session_id is required"}), 400
    
    # Basic email validation (match send-verification)
    email_raw = str(email or '')
    if '@' not in email_raw or '.' not in email_raw.split('@')[-1]:
        return jsonify({"error": "Invalid email format"}), 400

    try:
        email_clean = str(email).strip().lower()
        chon_sid = _as_uuid_str(user_session_id)
        if not chon_sid or not _user_session_row_exists(chon_sid):
            return jsonify({"error": "User session not found"}), 404

        existing = supabase.table('user_accounts').select('id').eq('email', email_clean).limit(1).execute()
        ensure_supabase_ok(existing, 'resend_verification check existing account')
        if existing.data:
            return jsonify({
                "error": "Account already exists for this email",
                "code": "ACCOUNT_EXISTS",
            }), 409

        try:
            up_em = supabase.table('user_sessions').update({
                'email': email_clean,
            }).eq('id', chon_sid).execute()
            ensure_supabase_ok(up_em, 'resend_verification patch user_sessions.email')
        except Exception as patch_err:
            print(f'Warning: resend_verification could not patch user_sessions.email: {patch_err}')

        # Generate new verification token
        verification_token = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(hours=24)

        _expire_unverified_email_verifications_for_email(email_clean)
        session_token = chon_sid if chon_sid else str(uuid.uuid4())
        insert_payload = {
            'email': email_clean,
            'verification_token': verification_token,
            'session_token': session_token,
            'expires_at': expires_at.isoformat(),
            'is_verified': False,
            'questionnaire_type': questionnaire_type
        }
        resend_ins = supabase.table('email_verifications').insert(insert_payload).execute()
        ensure_supabase_ok(resend_ins, "email_verifications resend insert")

        link_qs = {'verify': verification_token, 'mode': 'register'}
        if chon_sid:
            link_qs['sid'] = chon_sid
        verification_link = f"{FRONTEND_URL}/login?{urlencode(link_qs)}"
        try:
            _send_verification_link_email(email_clean, verification_link, language)
        except Exception as mail_err:
            print(f"Postmark resend verification email failed: {mail_err}")
            return jsonify({
                "success": False,
                "error": str(mail_err),
            }), 503
        
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
            # Not verified until email flow completes; False for no-email sessions too
            'email_verified': False,
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


@application.route('/user-sessions/<session_id>', methods=['PATCH'])
@require_database
def patch_user_session(session_id):
    """
    Update fields on an existing session.

    - ``email``: set when the user enters email during account verification on ``/login`` (does not set
      ``email_verified``; that happens only via ``GET /email/verify/<token>`` or ``POST /auth/callback``).
    - ``questionnaire_type``: set when the user confirms identity (mother/corporate/other/both)
      so batch saves and Q25 canonicalization match the chosen flow.
    - ``corporate_role``: optional, for corporate flow.

    At least one of email, questionnaire_type, or corporate_role must be provided.
    """
    data = request.get_json(silent=True) or {}
    email = data.get('email')
    questionnaire_type = data.get('questionnaire_type')

    if not any(k in data for k in ('email', 'questionnaire_type', 'corporate_role')):
        return jsonify({"error": "At least one of email, questionnaire_type, corporate_role is required"}), 400

    if email is not None:
        email = str(email).strip()
        if not email or '@' not in email or '.' not in email.split('@')[-1]:
            return jsonify({"error": "Invalid email format"}), 400

    if questionnaire_type is not None and questionnaire_type not in VALID_QUESTIONNAIRE_TYPES:
        return jsonify({"error": "Invalid questionnaire_type"}), 400

    patch = {}
    if email is not None:
        patch['email'] = email
    if questionnaire_type is not None:
        patch['questionnaire_type'] = questionnaire_type
        if questionnaire_type != 'corporate':
            patch['corporate_role'] = None
    if questionnaire_type == 'corporate' and 'corporate_role' in data:
        patch['corporate_role'] = data.get('corporate_role')

    try:
        exists = supabase.table('user_sessions').select('id').eq('id', session_id).limit(1).execute()
        ensure_supabase_ok(exists, "patch user_sessions lookup")
        if not exists.data:
            return jsonify({"error": "Session not found"}), 404

        up = supabase.table('user_sessions').update(patch).eq('id', session_id).execute()
        ensure_supabase_ok(up, "patch user_sessions")
        return jsonify({'success': True, 'user_session_id': session_id}), 200
    except Exception as e:
        print(f"Error patching user session: {str(e)}")
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

    required_score_fields = {'tag_english', 'unified_question_id', 'score'}
    for idx, score in enumerate(tag_scores):
        if not isinstance(score, dict):
            return jsonify({"error": f"tag_scores[{idx}] must be an object"}), 400
        missing = [k for k in required_score_fields if k not in score]
        if missing:
            return jsonify({"error": f"tag_scores[{idx}] missing fields: {', '.join(missing)}"}), 400
    
    try:
        for score in tag_scores:
            result = supabase.table('tag_scores').upsert({
                'user_session_id': user_session_id,
                'tag_english': score['tag_english'],
                'unified_question_id': _bounded_int(score['unified_question_id'], 'unified_question_id', 1),
                'score': _bounded_int(score['score'], 'score', 0, 100)
            }, on_conflict='user_session_id,tag_english,unified_question_id').execute()
            ensure_supabase_ok(result, "Failed to save tag score")
        
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
    Save tag statistics for a user session.

    Q25 bonus (+10% on one tag) is derived only from ``question_responses`` (normal
    MC row for unified question 25), not from client-supplied question_25_bonus_*.
    """
    data = request.get_json()
    user_session_id = data.get('user_session_id')
    statistics = data.get('statistics', [])
    
    if not user_session_id:
        return jsonify({"error": "user_session_id is required"}), 400
    
    if not statistics:
        return jsonify({"error": "statistics array is required"}), 400

    received_tags = {s.get('tag_english') for s in statistics if isinstance(s, dict)}
    if received_tags != EXPECTED_TAG_STATISTICS_TAGS:
        return jsonify({
            "error": "statistics must include exactly one row per tag (6 tags)",
            "expected": sorted(EXPECTED_TAG_STATISTICS_TAGS),
            "received": sorted(received_tags),
        }), 400

    required_stat_fields = {'tag_english', 'user_score', 'total_possible_score', 'score_percentage', 'answered_questions'}
    for idx, stat in enumerate(statistics):
        if not isinstance(stat, dict):
            return jsonify({"error": f"statistics[{idx}] must be an object"}), 400
        missing = [k for k in required_stat_fields if k not in stat]
        if missing:
            return jsonify({"error": f"statistics[{idx}] missing fields: {', '.join(missing)}"}), 400
    
    try:
        q25_choice = None
        try:
            q25_choice = fetch_question_25_choice_for_session(user_session_id)
        except Exception as e:
            print(f"Warning: failed to resolve question 25: {e}")
        bonus_tag = Q25_ANSWER_TO_TAG.get(q25_choice) if q25_choice else None

        for stat in statistics:
            tag_english = stat['tag_english']
            total_possible = _bounded_int(stat['total_possible_score'], 'total_possible_score')
            score_percentage = _bounded_int(stat['score_percentage'], 'score_percentage', 0, 100)
            user_score = _bounded_int(stat['user_score'], 'user_score')
            answered_questions = _bounded_int(stat['answered_questions'], 'answered_questions')
            bonus_applied = False

            if bonus_tag and tag_english == bonus_tag:
                bonus_applied = True
                score_percentage = min(100, score_percentage + 10)
                # Keep user_score consistent with score_percentage
                if isinstance(total_possible, (int, float)) and total_possible:
                    user_score = round((score_percentage / 100) * total_possible)

            result = supabase.table('tag_statistics').upsert({
                'user_session_id': user_session_id,
                'tag_english': tag_english,
                'user_score': user_score,
                'total_possible_score': total_possible,
                'score_percentage': score_percentage,
                'answered_questions': answered_questions,
                'question_25_bonus_applied': bonus_applied,
                'question_25_bonus_tag': bonus_tag if bonus_applied else None,
            }, on_conflict='user_session_id,tag_english').execute()
            ensure_supabase_ok(result, "Failed to save tag statistics")
        
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
    Save character matches for a user session.

    ``question_25_answer`` on each row is filled from ``question_responses`` only
    (same MC answer as question 25). Client ``question_25_answer`` fields are ignored.

    **End-to-end completion (client + DB):** the questionnaire flow should persist
    ``tag_scores`` rows, upsert all **six** ``tag_statistics`` rows (one per canonical
    ``tag_english``), then POST here with **six** ``character_matches`` (one per
    character id). On success this handler sets ``user_sessions.questionnaire_completed``
    and ``user_sessions.character_match`` (rank 1). ``user_sessions.email_verified`` is
    set only from email verification (GET ``/email/verify/...`` or auth callback), not
    from this endpoint.
    """
    data = request.get_json()
    user_session_id = data.get('user_session_id')
    matches = data.get('matches', [])
    
    if not user_session_id:
        return jsonify({"error": "user_session_id is required"}), 400
    
    if not matches:
        return jsonify({"error": "matches array is required"}), 400

    if len(matches) != 6:
        return jsonify({"error": "matches must contain exactly 6 rows (one per character)"}), 400
    char_ids = {str(m.get('character_id', '')).lower() for m in matches}
    if char_ids != EXPECTED_CHARACTER_IDS:
        return jsonify({
            "error": "matches must include each character_id exactly once",
            "expected": sorted(EXPECTED_CHARACTER_IDS),
            "received": sorted(char_ids),
        }), 400

    ranks = [m.get('match_rank') for m in matches]
    if len(ranks) != len(set(ranks)):
        return jsonify({"error": "Duplicate match_rank values in matches payload"}), 400

    required_match_fields = {'character_id', 'match_rank', 'final_percentage'}
    for idx, match in enumerate(matches):
        if not isinstance(match, dict):
            return jsonify({"error": f"matches[{idx}] must be an object"}), 400
        missing = [k for k in required_match_fields if k not in match]
        if missing:
            return jsonify({"error": f"matches[{idx}] missing fields: {', '.join(missing)}"}), 400
    
    try:
        q25_server = None
        try:
            q25_server = fetch_question_25_choice_for_session(user_session_id)
        except Exception as e:
            print(f"Warning: failed to resolve Q25 for character_matches: {e}")

        rows = []
        for match in matches:
            rows.append({
                'user_session_id': user_session_id,
                'character_id': match['character_id'],
                'match_rank': _bounded_int(match['match_rank'], 'match_rank', 1),
                'in_range_count': (
                    _bounded_int(match.get('in_range_count'), 'in_range_count', 0, 6)
                    if match.get('in_range_count') is not None else None
                ),
                'out_of_range_diff_sum': (
                    _bounded_int(match.get('out_of_range_diff_sum'), 'out_of_range_diff_sum')
                    if match.get('out_of_range_diff_sum') is not None else None
                ),
                'final_percentage': _bounded_int(match['final_percentage'], 'final_percentage', 0, 100),
                'question_25_answer': q25_server,
            })
        # Replace previous rows for this session to avoid duplicate accumulation
        # without requiring a DB unique constraint for upsert.
        purge = supabase.table('character_matches').delete().eq('user_session_id', user_session_id).execute()
        ensure_supabase_ok(purge, "Failed to clear prior character matches")

        result = supabase.table('character_matches').insert(rows).execute()
        ensure_supabase_ok(result, "Failed to insert character matches")
        
        # Update user_sessions with best match (rank 1)
        best_match = next((m for m in matches if m['match_rank'] == 1), None)
        update_warning = None
        if best_match:
            try:
                result = supabase.table('user_sessions').update({
                    'character_match': best_match['character_id'],
                    'completed_at': datetime.utcnow().isoformat(),
                    'questionnaire_completed': True
                }).eq('id', user_session_id).execute()
                ensure_supabase_ok(result, "Failed to update user session with best match")
            except Exception as e:
                update_warning = str(e)
                print(f"Warning: failed to update user session with best match: {e}")
        
        response_payload = {
            'success': True,
            'message': f'Successfully saved {len(matches)} character matches',
            'count': len(matches),
            'best_match': best_match['character_id'] if best_match else None
        }
        if update_warning:
            response_payload['warning'] = update_warning
        return jsonify(response_payload), 200
        
    except Exception as e:
        print(f"Error saving character matches: {str(e)}")
        return jsonify({"error": str(e)}), 500

@application.route('/user-sessions/<session_id>/saved-questionnaire-answers', methods=['GET'])
@require_database
def get_saved_questionnaire_answers(session_id):
    """
    Rebuild answer key → value map from question_responses rows that include this session
    in user_session_ids (used to resume on a new device after email verification).
    """
    try:
        uuid.UUID(str(session_id))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid session id"}), 400

    try:
        sess = supabase.table('user_sessions').select('id, questionnaire_type').eq(
            'id', session_id
        ).limit(1).execute()
        ensure_supabase_ok(sess, 'saved answers session lookup')
        if not sess.data:
            return jsonify({"error": "User session not found"}), 404

        questionnaire_type = sess.data[0].get('questionnaire_type') or 'mother'

        res = supabase.table('question_responses').select(
            'id, question_id, original_question_id, question_type, response_value, '
            'response_text, is_text_response, updated_at, created_at'
        ).contains('user_session_ids', [session_id]).execute()
        ensure_supabase_ok(res, 'saved answers question_responses')

        rows = res.data or []

        def row_sort_key(r):
            return (
                str(r.get('updated_at') or ''),
                str(r.get('created_at') or ''),
                str(r.get('id') or ''),
            )

        by_question_id = {}
        for r in rows:
            qid = str(r.get('question_id') or '').strip()
            if not qid:
                continue
            prev = by_question_id.get(qid)
            if prev is None or row_sort_key(r) > row_sort_key(prev):
                by_question_id[qid] = r

        answers = {}
        for qid, r in by_question_id.items():
            if r.get('is_text_response'):
                val = (r.get('response_text') or r.get('response_value') or '')
            else:
                val = (r.get('response_value') or r.get('response_text') or '')
            val = str(val).strip()
            if val:
                answers[qid] = val

        return jsonify({
            'success': True,
            'questionnaire_type': questionnaire_type,
            'answers': answers,
        }), 200

    except Exception as e:
        print(f"Error retrieving saved questionnaire answers: {str(e)}")
        return jsonify({"error": str(e)}), 500


def _export_answers_key_ok():
    """If CHON_EXPORT_ANSWERS_KEY is set, require matching X-CHON-Export-Key header."""
    required = os.getenv('CHON_EXPORT_ANSWERS_KEY')
    if not required:
        return True
    return request.headers.get('X-CHON-Export-Key') == required


@application.route('/internal/pre-supabase-capture', methods=['GET'])
def get_pre_supabase_capture():
    """
    Return in-memory payloads recorded immediately before Supabase ``question_responses`` writes.
    This is not the database — only traffic that passed through this process since startup
    (and only if CHON_PRE_SUPABASE_CAPTURE=1). Cleared on restart.

    Query: clear=1 empties the buffer after returning (only when capture is enabled).

    If CHON_EXPORT_ANSWERS_KEY is set, send header X-CHON-Export-Key (same as export endpoint).
    """
    if not _export_answers_key_ok():
        return jsonify({'error': 'Forbidden', 'hint': 'Set X-CHON-Export-Key if CHON_EXPORT_ANSWERS_KEY is configured'}), 403

    enabled = _pre_supabase_capture_enabled()
    clear = request.args.get('clear') == '1'
    with _PRE_SUPABASE_CAPTURE_LOCK:
        data = list(_PRE_SUPABASE_ANSWERS_CAPTURE)
        if clear and enabled:
            _PRE_SUPABASE_ANSWERS_CAPTURE.clear()
    return jsonify({
        'success': True,
        'capture_enabled': enabled,
        'count': len(data),
        'captures': data,
    }), 200


def _fetch_all_question_responses_rows():
    """Paginate through question_responses (PostgREST range limits apply per request)."""
    page_size = 1000
    offset = 0
    all_rows = []
    select_cols = (
        'id, questionnaire_type, question_id, original_question_id, question_type, '
        'response_value, response_text, is_text_response, count, user_session_ids, '
        'created_at, updated_at'
    )
    while True:
        result = supabase.table('question_responses').select(select_cols).order(
            'id', desc=False
        ).range(offset, offset + page_size - 1).execute()
        ensure_supabase_ok(result, 'question_responses export page')
        chunk = result.data or []
        all_rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size
    return all_rows


@application.route('/question-responses/all-by-session', methods=['GET'])
@require_database
def get_all_question_responses_by_session():
    """
    Export every stored answer flattened per user session (one entry per session per
    question_responses row that lists that session in user_session_ids).

    Sensitive: full questionnaire payload for all users. If env CHON_EXPORT_ANSWERS_KEY
    is set, send header X-CHON-Export-Key with that value.

    Query params:
      - include_empty_session_ids: if 1, include rows where user_session_ids is empty
        as a single record with user_session_id null (aggregate edge cases).
    """
    if not _export_answers_key_ok():
        return jsonify({'error': 'Forbidden', 'hint': 'Set X-CHON-Export-Key if CHON_EXPORT_ANSWERS_KEY is configured'}), 403

    include_empty = request.args.get('include_empty_session_ids') == '1'

    try:
        raw_rows = _fetch_all_question_responses_rows()
    except Exception as e:
        print(f"Error fetching question_responses for export: {e}")
        return jsonify({'error': str(e)}), 500

    entries = []
    for r in raw_rows:
        sids = r.get('user_session_ids') or []
        is_text = bool(r.get('is_text_response'))
        if is_text:
            answer = (r.get('response_text') or r.get('response_value') or '')
        else:
            answer = (r.get('response_value') or r.get('response_text') or '')
        answer = str(answer).strip()

        base = {
            'question_response_id': r.get('id'),
            'questionnaire_type': r.get('questionnaire_type'),
            'question_id': r.get('question_id'),
            'original_question_id': r.get('original_question_id'),
            'question_type': r.get('question_type'),
            'answer': answer,
            'is_text_response': is_text,
            'aggregate_count': r.get('count'),
            'created_at': r.get('created_at'),
            'updated_at': r.get('updated_at'),
        }

        if not sids:
            if include_empty:
                entries.append({**base, 'user_session_id': None})
            continue

        for sid in sids:
            try:
                sid_str = str(uuid.UUID(str(sid)))
            except (ValueError, TypeError):
                sid_str = str(sid)
            entries.append({**base, 'user_session_id': sid_str})

    return jsonify({
        'success': True,
        'total_question_response_rows': len(raw_rows),
        'total_flattened_entries': len(entries),
        'entries': entries,
    }), 200


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
    Create a user account linked to a completed personality-test session.

    Requires the linked ``user_sessions`` row to have ``email_verified`` true and a matching ``email``.
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
        normalized_email = email.strip().lower()

        session_result = supabase.table('user_sessions').select(
            'id,email,email_verified'
        ).eq('id', user_session_id).limit(1).execute()
        ensure_supabase_ok(session_result, "Failed to fetch user session")
        if not session_result.data:
            return jsonify({"error": "User session not found"}), 404

        session_row = session_result.data[0]
        if not session_row.get('email_verified'):
            return jsonify({
                "error": "Email must be verified before creating an account",
                "code": "EMAIL_NOT_VERIFIED",
            }), 403

        session_email = (session_row.get('email') or '').strip().lower()
        if session_email and session_email != normalized_email:
            return jsonify({
                "error": "Email does not match verified email",
                "code": "EMAIL_MISMATCH"
            }), 400
        if not session_email:
            return jsonify({
                "error": "Verified email is missing on this session",
                "code": "EMAIL_NOT_VERIFIED",
            }), 403

        # Check for existing account by email to avoid unique constraint violation
        existing = supabase.table('user_accounts').select('id').eq('email', normalized_email).limit(1).execute()
        ensure_supabase_ok(existing, "Failed to check existing account")
        if existing.data:
            return jsonify({
                "error": "Account already exists for this email",
                "code": "ACCOUNT_EXISTS"
            }), 409

        password_hash = generate_password_hash(password)
        result = supabase.table('user_accounts').insert({
            'email': normalized_email,
            'password_hash': password_hash,
            'user_session_id': user_session_id,
            'name': name
        }).execute()
        ensure_supabase_ok(result, "Failed to create user account")

        return jsonify({"success": True, "message": "User account created"}), 200
    except Exception as e:
        print(f"Error creating user account: {str(e)}")
        return jsonify({"error": str(e)}), 500


def _supabase_user_from_access_token(access_token: str) -> Optional[dict]:
    """Validate Supabase access JWT via Auth REST GET /auth/v1/user."""
    if not supabase_url or not supabase_key or not access_token:
        return None
    try:
        u = f"{str(supabase_url).rstrip('/')}/auth/v1/user"
        req = urllib.request.Request(
            u,
            headers={
                "Authorization": f"Bearer {access_token}",
                "apikey": supabase_key,
            },
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
            if resp.status != 200:
                return None
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        try:
            print(f"auth/v1/user HTTP {e.code}: {e.read().decode()}")
        except Exception:
            print(f"auth/v1/user HTTP {e.code}")
        return None
    except Exception as e:
        print(f"auth/v1/user error: {e}")
        return None


def _verify_chon_account_password(email: str, password: str):
    """
    Returns (user_session_id, None) on success (user_session_id may be None if unlinked).
    Returns (None, error_message) on invalid credentials or missing account.
    """
    row = supabase.table('user_accounts').select('password_hash, user_session_id').eq('email', email).limit(1).execute()
    ensure_supabase_ok(row, "login select user_accounts")
    if not row.data:
        return None, 'Invalid email or password'
    ph = row.data[0].get('password_hash')
    user_session_id = row.data[0].get('user_session_id')
    if not ph or not check_password_hash(ph, password):
        return None, 'Invalid email or password'
    return user_session_id, None


def _account_snapshot_payload(user_session_id: str) -> dict:
    """Build tag stats + session metadata for login response (same shape as legacy login-snapshot)."""
    stats_res = supabase.table('tag_statistics').select(
        'tag_english, user_score, total_possible_score, score_percentage, answered_questions, '
        'question_25_bonus_applied, question_25_bonus_tag'
    ).eq('user_session_id', user_session_id).execute()
    ensure_supabase_ok(stats_res, "login snapshot tag_statistics")

    sess_res = supabase.table('user_sessions').select(
        'questionnaire_type, questionnaire_completed, character_match, email'
    ).eq('id', user_session_id).limit(1).execute()
    ensure_supabase_ok(sess_res, "login snapshot user_sessions")
    sess = sess_res.data[0] if sess_res.data else {}

    rows = stats_res.data or []
    tag_stats_zh = {}
    for row in rows:
        eng = row.get('tag_english')
        zh = _TAG_EN_TO_ZH.get(eng)
        if not zh:
            continue
        tag_stats_zh[zh] = {
            'userScore': row.get('user_score'),
            'totalPossibleScore': row.get('total_possible_score'),
            'scorePercentage': row.get('score_percentage'),
            'answeredQuestions': row.get('answered_questions'),
            'question25BonusApplied': row.get('question_25_bonus_applied'),
            'question25BonusTag': row.get('question_25_bonus_tag'),
        }

    has_full_stats = len(tag_stats_zh) == len(EXPECTED_TAG_STATISTICS_TAGS)
    questionnaire_completed = bool(sess.get('questionnaire_completed'))

    return {
        'user_session_id': str(user_session_id),
        'questionnaire_type': sess.get('questionnaire_type'),
        'questionnaire_completed': questionnaire_completed,
        'character_match': sess.get('character_match'),
        'tag_statistics': rows,
        'tag_stats_local_storage': tag_stats_zh,
        'has_results': has_full_stats,
    }


@application.route('/user-accounts/login', methods=['POST'])
@require_database
def user_account_login():
    """
    Verify email + password against CHON user_accounts, then return session snapshot in the same response.
    (Snapshot data must never be returned without a verified password — see login-snapshot hardening.)
    """
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400
    try:
        user_session_id, err = _verify_chon_account_password(email, password)
        if err:
            return jsonify({"success": False, "error": err}), 401
        if not user_session_id:
            return jsonify({"success": True, "user_session_id": None, "has_results": False}), 200
        snap = _account_snapshot_payload(str(user_session_id))
        return jsonify({"success": True, **snap}), 200
    except Exception as e:
        print(f"Error login: {str(e)}")
        return jsonify({"error": str(e)}), 500


@application.route('/user-accounts/password', methods=['PATCH'])
@require_database
def user_account_sync_password_after_supabase():
    """
    After Supabase auth.updateUser({ password }) (reset-password page), sync CHON user_accounts
    so only the new password works for POST /user-accounts/login.
    Requires Authorization: Bearer <access_token> and JSON {\"password\": \"...\"}.
    """
    auth_header = request.headers.get('Authorization') or ''
    if not auth_header.startswith('Bearer '):
        return jsonify({"error": "Authorization Bearer token required"}), 401
    token = auth_header[7:].strip()
    data = request.get_json() or {}
    new_password = data.get('password')
    if not new_password or len(str(new_password)) < 8:
        return jsonify({"error": "password must be at least 8 characters"}), 400

    user_obj = _supabase_user_from_access_token(token)
    if not user_obj or not user_obj.get('email'):
        return jsonify({"error": "Invalid or expired session"}), 401

    email = str(user_obj.get('email')).strip().lower()
    try:
        exists = supabase.table('user_accounts').select('id').eq('email', email).limit(1).execute()
        ensure_supabase_ok(exists, "sync password lookup user_accounts")
        if not exists.data:
            return jsonify({
                "error": "No CHON account for this email. Register after completing the questionnaire first.",
                "code": "NO_CHON_ACCOUNT",
            }), 404

        ph = generate_password_hash(str(new_password))
        up = supabase.table('user_accounts').update({
            'password_hash': ph,
        }).eq('email', email).execute()
        ensure_supabase_ok(up, "sync password update user_accounts")

        verify = supabase.table('user_accounts').select('password_hash').eq('email', email).limit(1).execute()
        ensure_supabase_ok(verify, "sync password verify select user_accounts")
        stored = verify.data[0].get('password_hash') if verify.data else None
        if not stored or not check_password_hash(stored, str(new_password)):
            print("sync password: post-update check_password_hash failed", email)
            return jsonify({"error": "Password hash verification failed after update"}), 500

        return jsonify({"success": True}), 200
    except Exception as e:
        print(f"Error sync password: {str(e)}")
        return jsonify({"error": str(e)}), 500


@application.route('/user-accounts/exists', methods=['POST'])
@require_database
def user_account_exists():
    """
    Check if a user account exists for an email.
    Expects JSON: {"email": "..."}
    """
    data = request.get_json()
    email = data.get('email')

    if not email:
        return jsonify({"error": "email is required"}), 400

    try:
        result = supabase.table('user_accounts').select('id').eq('email', email).limit(1).execute()
        exists = bool(result.data)
        return jsonify({"exists": exists}), 200
    except Exception as e:
        print(f"Error checking user account: {str(e)}")
        return jsonify({"error": str(e)}), 500


@application.route('/user-accounts/login-snapshot', methods=['POST'])
@require_database
def user_account_login_snapshot():
    """
    Same payload as POST /user-accounts/login but for clients that already verified credentials
    elsewhere. **Requires password** — never return tag/session data for email-only requests.
    Expects JSON: {"email": "...", "password": "..."}
    """
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    try:
        user_session_id, err = _verify_chon_account_password(email, password)
        if err:
            return jsonify({"success": False, "error": err}), 401
        if not user_session_id:
            return jsonify({"success": True, "user_session_id": None, "has_results": False}), 200
        snap = _account_snapshot_payload(str(user_session_id))
        return jsonify({"success": True, **snap}), 200
    except Exception as e:
        print(f"Error login snapshot: {str(e)}")
        return jsonify({"error": str(e)}), 500

@application.route('/auth/callback', methods=['POST'])
@require_database
def auth_callback_sync():
    """
    Sync CHON after the user completes **Supabase Auth** (clicks the magic link in the Supabase email).

    Sets ``email_verifications.is_verified`` / ``verified_at`` (via ``mark_email_verification_verified``)
    and ``user_sessions.email_verified`` for the linked CHON session — same outcome as
    ``GET /email/verify/<token>`` for the Postmark path.

    Expects JSON: {
      "email": "...",
      "auth_user_id": "...",
      "questionnaire_type": optional,
      "user_session_id": optional CHON ``user_sessions.id`` (from localStorage) — strongly recommended
      so the correct ``email_verifications`` row (``session_token``) is found when Postmark also created one.
    }
    """
    data = request.get_json(silent=True) or {}
    email = data.get('email')
    auth_user_id = data.get('auth_user_id')
    body_sid_raw = data.get('user_session_id') or data.get('userSessionId')

    if not email:
        return jsonify({"error": "email is required"}), 400

    email_clean = str(email).strip().lower()
    body_session_uuid = None
    if body_sid_raw:
        try:
            body_session_uuid = str(uuid.UUID(str(body_sid_raw).strip()))
        except (ValueError, TypeError):
            body_session_uuid = None

    try:
        session_row = None
        if body_session_uuid:
            by_id = supabase.table('user_sessions').select(
                'id, questionnaire_type, email'
            ).eq('id', body_session_uuid).limit(1).execute()
            ensure_supabase_ok(by_id, "auth_callback user_sessions by id")
            if by_id.data:
                session_row = by_id.data[0]
        if not session_row:
            session_row = find_latest_session_for_verification(email=email_clean, session_token=None)

        session_questionnaire_type = None
        if session_row:
            session_questionnaire_type = session_row.get('questionnaire_type')
        if data.get('questionnaire_type'):
            session_questionnaire_type = data['questionnaire_type']

        # Prefer email_verifications row created for this CHON session (session_token = user_sessions.id).
        ev_id = None
        if body_session_uuid:
            # Prefer the row created for this CHON session (send-verification sets session_token = user_sessions.id).
            # Do not require is_verified=False so re-sync / duplicate magic-link opens still resolve the same row.
            ev_by_sess = supabase.table('email_verifications').select('id').eq(
                'session_token', body_session_uuid
            ).order('created_at', desc=True).limit(1).execute()
            ensure_supabase_ok(ev_by_sess, "auth_callback email_verifications by session_token")
            if ev_by_sess.data:
                ev_id = ev_by_sess.data[0].get('id')
        if not ev_id:
            latest = supabase.table('email_verifications').select('id').eq(
                'email', email_clean
            ).order('created_at', desc=True).limit(1).execute()
            ensure_supabase_ok(latest, "auth_callback email_verifications by exact email")
            if latest.data:
                ev_id = latest.data[0].get('id')
        if not ev_id:
            latest_ci = supabase.table('email_verifications').select('id').ilike(
                'email', email_clean
            ).order('created_at', desc=True).limit(1).execute()
            ensure_supabase_ok(latest_ci, "auth_callback email_verifications by ilike email")
            if latest_ci.data:
                ev_id = latest_ci.data[0].get('id')

        if not ev_id:
            fallback_sid = body_session_uuid
            if not fallback_sid and session_row and session_row.get('id'):
                fallback_sid = str(session_row['id'])
            insert_row = {
                'email': email_clean,
                'verification_token': auth_user_id or str(uuid.uuid4()),
                'session_token': fallback_sid or str(uuid.uuid4()),
                'is_verified': True,
                'verified_at': datetime.now(timezone.utc).isoformat(),
                'expires_at': (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            }
            if session_questionnaire_type:
                insert_row['questionnaire_type'] = session_questionnaire_type
            ins = supabase.table('email_verifications').insert(insert_row).execute()
            ensure_supabase_ok(ins, "auth_callback insert email_verifications")
            if ins.data:
                ev_id = ins.data[0].get('id')

        if ev_id:
            mark_email_verification_verified(
                record_id=ev_id,
                questionnaire_type=session_questionnaire_type,
            )

        legacy_from_ev = None
        if ev_id:
            ev_row = supabase.table('email_verifications').select('session_token').eq(
                'id', ev_id
            ).limit(1).execute()
            ensure_supabase_ok(ev_row, 'auth_callback read email_verifications session_token')
            if ev_row.data:
                legacy_from_ev = ev_row.data[0].get('session_token')

        sid_set = _collect_user_session_ids_for_email_verified(
            verified_email=email_clean,
            legacy_session_token=legacy_from_ev,
            body_session_id=body_session_uuid,
            include_most_recent_by_email=not bool(body_session_uuid),
        )
        _apply_email_verified_to_user_sessions(verified_email=email_clean, session_ids=sid_set)

        canonical = find_most_recent_user_session_for_email(email_clean)
        # Do not repoint ``email_verifications.session_token`` away from the browser-supplied CHON session;
        # that caused "two sessions" / lost-progress confusion when another row existed for the same email.
        if ev_id and canonical and canonical.get('id') and not body_session_uuid:
            try:
                supabase.table('email_verifications').update({
                    'session_token': str(canonical['id']),
                }).eq('id', ev_id).execute()
            except Exception as repoint_err:
                print(f"Warning: auth_callback could not repoint email_verifications.session_token: {repoint_err}")

        out_session_id = None
        if body_session_uuid:
            out_session_id = str(body_session_uuid)
        elif session_row and session_row.get('id'):
            out_session_id = str(session_row['id'])
        elif canonical and canonical.get('id'):
            out_session_id = str(canonical['id'])

        payload = {"success": True}
        if out_session_id:
            payload["userSessionId"] = out_session_id
        return jsonify(payload), 200
    except Exception as e:
        print(f"Error syncing auth callback: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    application.run(host='0.0.0.0', port=port)
