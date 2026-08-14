import secrets
import re
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models_auth import db, User
from models import Team, TeamMember, TeamInvite, Project, Role, Notification
from decorators import require_team_role
from email_service import send_team_invite_email, FRONTEND_URL

teams_bp = Blueprint("teams", __name__)

INVITE_EXPIRY_DAYS = 7
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _team_card(team, my_role):
    """Shapes one team for the list view: real member list + real project count."""
    data = team.to_dict(my_role=my_role)
    data["members"] = [
        {"user_id": m.user_id, "username": m.user.username, "avatar_url": m.user.avatar_url}
        for m in team.members
    ]
    data["architectures"] = Project.query.filter_by(team_id=team.id).count()
    return data


@teams_bp.route("/teams/<int:team_id>/projects", methods=["GET"])
@require_team_role("viewer")
def list_team_projects(team_id):
    """
    Lists every architecture belonging to this squad — powers the
    "Open" action on the Team page, which shows all of a squad's
    projects and lets you jump straight into one's workspace.
    """
    projects = Project.query.filter_by(team_id=team_id).order_by(Project.created_at.desc()).all()
    return jsonify([p.to_dict() for p in projects]), 200


@teams_bp.route("/teams", methods=["GET"])
@jwt_required()
def list_teams():
    """Lists every squad the current user belongs to, with their role in each."""
    user_id = get_jwt_identity()
    memberships = TeamMember.query.filter_by(user_id=user_id).all()
    return jsonify([_team_card(m.team, m.role_name) for m in memberships]), 200


@teams_bp.route("/teams/summary", methods=["GET"])
@jwt_required()
def teams_summary():
    """Powers the 3 stat cards at the top of the Team page."""
    user_id = get_jwt_identity()
    memberships = TeamMember.query.filter_by(user_id=user_id).all()
    team_ids = [m.team_id for m in memberships]

    if not team_ids:
        return jsonify({"engineers": 0, "architectures": 0, "pending_invites": 0}), 200

    engineer_ids = {
        m.user_id for m in TeamMember.query.filter(TeamMember.team_id.in_(team_ids)).all()
    }
    architectures = Project.query.filter(Project.team_id.in_(team_ids)).count()

    owned_team_ids = [m.team_id for m in memberships if m.role_name == "owner"]
    pending_invites = 0
    if owned_team_ids:
        pending_invites = TeamInvite.query.filter(
            TeamInvite.team_id.in_(owned_team_ids),
            TeamInvite.status == "pending"
        ).count()

    return jsonify({
        "engineers": len(engineer_ids),
        "architectures": architectures,
        "pending_invites": pending_invites
    }), 200


@teams_bp.route("/teams", methods=["POST"])
@jwt_required()
def create_team():
    """Creates a new squad. The creator automatically becomes owner."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    team = Team(name=name, focus=(data.get("focus") or "").strip() or None, owner_id=user_id)
    db.session.add(team)
    db.session.flush()

    owner_role = Role.query.filter_by(name="owner").first()
    if not owner_role:
        return jsonify({"error": "owner role not seeded yet — run seed_roles.py"}), 500

    db.session.add(TeamMember(team_id=team.id, user_id=user_id, role_id=owner_role.id))
    db.session.commit()

    return jsonify(_team_card(team, "owner")), 201


@teams_bp.route("/teams/<int:team_id>", methods=["PATCH"])
@require_team_role("owner")
def update_team(team_id):
    """Renames a squad / updates its focus area. Owner only."""
    data = request.get_json() or {}
    team = Team.query.get_or_404(team_id)

    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "name cannot be empty"}), 400
        team.name = name
    if "focus" in data:
        team.focus = (data.get("focus") or "").strip() or None

    db.session.commit()

    membership = TeamMember.query.filter_by(team_id=team_id, user_id=get_jwt_identity()).first()
    return jsonify(_team_card(team, membership.role_name)), 200


@teams_bp.route("/teams/<int:team_id>", methods=["DELETE"])
@require_team_role("owner")
def delete_team(team_id):
    """
    Deletes a squad. Projects that belonged to it are NOT deleted —
    they're just detached (team_id set back to null) — deleting a squad
    shouldn't destroy anyone's actual architecture work.
    """
    team = Team.query.get_or_404(team_id)
    Project.query.filter_by(team_id=team_id).update({"team_id": None})
    db.session.delete(team)
    db.session.commit()
    return jsonify({"message": f'Deleted "{team.name}"'}), 200


@teams_bp.route("/teams/<int:team_id>/leave", methods=["POST"])
@require_team_role("viewer")
def leave_team(team_id):
    """
    Leaves a squad. If you're the sole owner with other members still
    present, you're blocked — the squad needs an owner. If you're the
    sole owner AND the sole member, leaving deletes the (now-empty)
    squad entirely, detaching its projects like delete_team does.
    """
    user_id = get_jwt_identity()
    membership = TeamMember.query.filter_by(team_id=team_id, user_id=user_id).first()
    team = membership.team

    if membership.role_name == "owner":
        other_members = TeamMember.query.filter(
            TeamMember.team_id == team_id, TeamMember.user_id != user_id
        ).count()
        if other_members > 0:
            return jsonify({
                "error": "You're the only owner — delete the squad, or make someone else owner first."
            }), 400
        Project.query.filter_by(team_id=team_id).update({"team_id": None})
        db.session.delete(team)
        db.session.commit()
        return jsonify({"message": f'Left and closed "{team.name}" (you were the only member)'}), 200

    db.session.delete(membership)
    db.session.commit()
    return jsonify({"message": f'Left "{team.name}"'}), 200


@teams_bp.route("/teams/<int:team_id>/members/<int:user_id>", methods=["DELETE"])
@require_team_role("owner")
def remove_team_member(team_id, user_id):
    """Removes someone else from the squad. Owner only. Can't remove yourself here — use leave."""
    if user_id == get_jwt_identity():
        return jsonify({"error": "Use the leave-squad action to remove yourself"}), 400

    membership = TeamMember.query.filter_by(team_id=team_id, user_id=user_id).first()
    if not membership:
        return jsonify({"error": "That user isn't a member of this squad"}), 404

    db.session.delete(membership)
    db.session.commit()
    return jsonify({"message": "Member removed"}), 200


@teams_bp.route("/teams/<int:team_id>/invite", methods=["POST"])
@require_team_role("owner")
def invite_to_team(team_id):
    """
    Creates a team invite, either:
    - method "email": sends a real email to the given address.
    - method "link": just returns a shareable link, no email sent.
    Body: { "method": "email"|"link", "email": "...", "role": "editor" }
    """
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    method = data.get("method")
    role_name = data.get("role")
    email = (data.get("email") or "").strip().lower()

    if method not in ("email", "link"):
        return jsonify({"error": "method must be 'email' or 'link'"}), 400

    role = Role.query.filter_by(name=role_name).first()
    if not role:
        return jsonify({"error": f"'{role_name}' is not a valid role. Use viewer, editor, or owner"}), 400

    if method == "email":
        if not email or not EMAIL_RE.match(email):
            return jsonify({"error": "A valid email is required for method='email'"}), 400

    team = Team.query.get_or_404(team_id)
    inviter = User.query.get(user_id)

    invite = TeamInvite(
        team_id=team_id,
        email=email if method == "email" else None,
        role_id=role.id,
        token=secrets.token_urlsafe(24),
        invited_by=user_id,
        status="pending",
        expires_at=datetime.utcnow() + timedelta(days=INVITE_EXPIRY_DAYS),
    )
    db.session.add(invite)
    db.session.flush()

    invite_link = f"{FRONTEND_URL}/team/invite/{invite.token}"

    if method == "link":
        db.session.commit()
        return jsonify({"message": "Invite link created", "invite_link": invite_link}), 201

    existing_user = User.query.filter_by(email=email).first()
    if existing_user and existing_user.notifications_enabled:
        db.session.add(Notification(
            user_id=existing_user.id,
            type="invite",
            message=f'{inviter.username} invited you to join "{team.name}" as {role_name}.',
        ))

    try:
        send_team_invite_email(email, team.name, inviter.username, role_name, invite.token)
    except Exception as e:
        db.session.commit()
        return jsonify({
            "error": f"Invite created but the email failed to send ({e}). Share this link instead:",
            "invite_link": invite_link
        }), 502

    db.session.commit()
    return jsonify({"message": f"Invite sent to {email}", "invite_link": invite_link}), 201


@teams_bp.route("/teams/invites/<string:token>", methods=["GET"])
@jwt_required()
def preview_invite(token):
    """Lets the frontend show 'X invited you to Y as Z' before the user accepts."""
    invite = TeamInvite.query.filter_by(token=token).first()
    if not invite:
        return jsonify({"error": "This invite link is invalid"}), 404

    expired = invite.expires_at is not None and invite.expires_at < datetime.utcnow()
    return jsonify({
        "team_name": invite.team.name,
        "inviter_username": invite.inviter.username if invite.inviter else None,
        "role": invite.role_name,
        "status": invite.status,
        "expired": expired,
        "is_link_invite": invite.is_link_invite,
    }), 200


@teams_bp.route("/teams/invites/<string:token>/accept", methods=["POST"])
@jwt_required()
def accept_invite(token):
    """Accepts a team invite — email invites must match the logged-in user's email."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    invite = TeamInvite.query.filter_by(token=token).first()
    if not invite:
        return jsonify({"error": "This invite link is invalid"}), 404

    if invite.status == "revoked":
        return jsonify({"error": "This invite has been revoked"}), 410
    if invite.status == "accepted" and not invite.is_link_invite:
        return jsonify({"error": "This invite has already been used"}), 410
    if invite.expires_at is not None and invite.expires_at < datetime.utcnow():
        return jsonify({"error": "This invite has expired"}), 410

    if invite.email and invite.email.lower() != user.email.lower():
        return jsonify({"error": "This invite was sent to a different email address"}), 403

    existing = TeamMember.query.filter_by(team_id=invite.team_id, user_id=user_id).first()
    if existing:
        existing.role_id = invite.role_id
    else:
        db.session.add(TeamMember(team_id=invite.team_id, user_id=user_id, role_id=invite.role_id))

    if not invite.is_link_invite:
        invite.status = "accepted"
        invite.accepted_by = user_id
        invite.accepted_at = datetime.utcnow()

    db.session.commit()

    team = Team.query.get(invite.team_id)
    membership = TeamMember.query.filter_by(team_id=invite.team_id, user_id=user_id).first()
    return jsonify(_team_card(team, membership.role_name)), 200


@teams_bp.route("/teams/<int:team_id>/invite-link", methods=["GET"])
@require_team_role("owner")
def get_or_create_quick_link(team_id):
    """
    Backs the row menu's "Copy invite link" action: reuses an existing
    live link invite for this team (as editor) if one exists, otherwise
    creates one. Keeps that menu item a single click, no modal needed.
    """
    existing = TeamInvite.query.filter_by(
        team_id=team_id, email=None, status="pending"
    ).filter(
        (TeamInvite.expires_at == None) | (TeamInvite.expires_at > datetime.utcnow())  # noqa: E711
    ).first()

    if existing:
        return jsonify({"invite_link": f"{FRONTEND_URL}/team/invite/{existing.token}"}), 200

    role = Role.query.filter_by(name="editor").first()
    invite = TeamInvite(
        team_id=team_id,
        email=None,
        role_id=role.id,
        token=secrets.token_urlsafe(24),
        invited_by=get_jwt_identity(),
        status="pending",
        expires_at=datetime.utcnow() + timedelta(days=INVITE_EXPIRY_DAYS),
    )
    db.session.add(invite)
    db.session.commit()
    return jsonify({"invite_link": f"{FRONTEND_URL}/team/invite/{invite.token}"}), 201