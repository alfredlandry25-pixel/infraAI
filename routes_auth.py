import re
import os
import uuid
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)
from werkzeug.utils import secure_filename

from models_auth import db, User, Role
from models import Design

auth_bp = Blueprint("auth", __name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ALLOWED_AVATAR_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}
MAX_AVATAR_BYTES = 3 * 1024 * 1024  # 3MB
AVATAR_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "avatars")


def _default_role() -> Role:
    """Ensure a 'user' role exists and return it, for new signups."""
    role = Role.query.filter_by(name="user").first()
    if role is None:
        role = Role(name="user", description="Default account role")
        db.session.add(role)
        db.session.commit()
    return role


def _make_tokens(user: User):
    additional_claims = {"role": user.role_name, "username": user.username}
    access_token = create_access_token(
        identity=str(user.id), additional_claims=additional_claims
    )
    refresh_token = create_refresh_token(
        identity=str(user.id), additional_claims=additional_claims
    )
    return access_token, refresh_token


@auth_bp.post("/signup")
def signup():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not email or not username or not password:
        return jsonify({"error": "email, username and password are required"}), 400
    if not EMAIL_RE.match(email):
        return jsonify({"error": "invalid email format"}), 400
    if len(password) < 8:
        return jsonify({"error": "password must be at least 8 characters"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "email already registered"}), 409
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "username already taken"}), 409

    user = User(email=email, username=username, role=_default_role())
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    access_token, refresh_token = _make_tokens(user)
    return (
        jsonify(
            {
                "user": user.to_dict(),
                "access_token": access_token,
                "refresh_token": refresh_token,
            }
        ),
        201,
    )


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    user = User.query.filter_by(email=email).first()
    if user is None or not user.check_password(password):
        return jsonify({"error": "invalid email or password"}), 401
    if not user.is_active:
        return jsonify({"error": "account is disabled"}), 403

    access_token, refresh_token = _make_tokens(user)
    return jsonify(
        {
            "user": user.to_dict(),
            "access_token": access_token,
            "refresh_token": refresh_token,
        }
    )


@auth_bp.get("/me")
@jwt_required()
def me():
    """Sanity-check what a token exposes — returns identity + claims
    straight from the JWT."""
    user_id = get_jwt_identity()
    claims = get_jwt()
    user = db.session.get(User, int(user_id))
    if user is None:
        return jsonify({"error": "user not found"}), 404
    return jsonify({"user": user.to_dict(), "token_claims": claims})


@auth_bp.route("/me", methods=["PATCH"])
@jwt_required()
def update_me():
    """
    Updates the logged-in user's profile: username, email, notification
    preference, and/or password. Changing the password requires the
    correct current_password — this is a real account-security control,
    not decorative, since it stops a stolen/left-open session from
    silently taking over the account with zero re-authentication.
    """
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}

    if "username" in data:
        username = (data.get("username") or "").strip()
        if not username:
            return jsonify({"error": "username cannot be empty"}), 400
        existing = User.query.filter_by(username=username).first()
        if existing and existing.id != user.id:
            return jsonify({"error": "username already taken"}), 409
        user.username = username

    if "email" in data:
        email = (data.get("email") or "").strip().lower()
        if not EMAIL_RE.match(email):
            return jsonify({"error": "invalid email format"}), 400
        existing = User.query.filter_by(email=email).first()
        if existing and existing.id != user.id:
            return jsonify({"error": "email already registered"}), 409
        user.email = email

    if "notifications_enabled" in data:
        user.notifications_enabled = bool(data.get("notifications_enabled"))

    if data.get("new_password"):
        current_password = data.get("current_password") or ""
        if not user.check_password(current_password):
            return jsonify({"error": "Current password is incorrect"}), 403
        new_password = data.get("new_password")
        if len(new_password) < 8:
            return jsonify({"error": "New password must be at least 8 characters"}), 400
        user.set_password(new_password)

    db.session.commit()
    return jsonify({"user": user.to_dict()}), 200


@auth_bp.route("/me/avatar", methods=["POST"])
@jwt_required()
def upload_avatar():
    """
    Accepts a multipart file upload (`avatar` field), saves it to disk,
    and points the user's avatar_url at it. Stored on local disk behind
    Flask's static route — fine for a single-instance deployment; a
    multi-instance/horizontally-scaled deployment would need this in
    S3/Cloudinary/etc instead, since local disk isn't shared across
    instances.
    """
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)

    file = request.files.get("avatar")
    if not file or file.filename == "":
        return jsonify({"error": "No file provided (expected multipart field 'avatar')"}), 400

    ext = secure_filename(file.filename).rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_AVATAR_EXTENSIONS:
        return jsonify({"error": f"Unsupported file type. Use: {', '.join(sorted(ALLOWED_AVATAR_EXTENSIONS))}"}), 400

    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    if size > MAX_AVATAR_BYTES:
        return jsonify({"error": "Image must be under 3MB"}), 400

    os.makedirs(AVATAR_DIR, exist_ok=True)

    for existing_name in os.listdir(AVATAR_DIR):
        if existing_name.startswith(f"user{user.id}."):
            try:
                os.remove(os.path.join(AVATAR_DIR, existing_name))
            except OSError:
                pass

    filename = f"user{user.id}.{ext}"
    filepath = os.path.join(AVATAR_DIR, filename)
    file.save(filepath)

    user.avatar_url = f"/static/avatars/{filename}?v={uuid.uuid4().hex[:8]}"
    db.session.commit()

    return jsonify({"user": user.to_dict()}), 200


@auth_bp.route("/me/usage", methods=["GET"])
@jwt_required()
def my_usage():
    """
    Returns how many AI generations this user has triggered so far this
    calendar month — a real count from Design.created_by, not a fake
    number. There's no plan/quota system yet, so no cap is implied.
    """
    user_id = get_jwt_identity()
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    count = Design.query.filter(
        Design.created_by == user_id,
        Design.created_at >= month_start.replace(tzinfo=None)
    ).count()

    return jsonify({"generations_this_month": count}), 200