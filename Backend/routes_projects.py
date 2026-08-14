from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models_auth import db, Role, User
from models import Project, ProjectMember, Role, Design, Notification, TeamMember
from decorators import require_role, get_effective_project_role, get_effective_members, get_effective_member_count

projects_bp = Blueprint("projects", __name__)


@projects_bp.route("/projects", methods=["GET"])
@jwt_required()
def list_projects():
    """
    Lists every project the current user can access — either through a
    direct invite (ProjectMember) or through membership in the squad
    that owns the project (Project.team_id + TeamMember) — along with
    their effective role in each.
    """
    user_id = get_jwt_identity()

    direct_project_ids = {m.project_id for m in ProjectMember.query.filter_by(user_id=user_id).all()}

    team_ids = {m.team_id for m in TeamMember.query.filter_by(user_id=user_id).all()}
    squad_project_ids = set()
    if team_ids:
        squad_project_ids = {p.id for p in Project.query.filter(Project.team_id.in_(team_ids)).all()}

    projects = []
    for pid in direct_project_ids | squad_project_ids:
        project = Project.query.get(pid)
        if not project:
            continue
        data = project.to_dict()
        data["my_role"] = get_effective_project_role(user_id, pid)
        data["member_count"] = get_effective_member_count(pid)
        projects.append(data)

    return jsonify(projects), 200


@projects_bp.route("/projects", methods=["POST"])
@jwt_required()
def create_project():
    """
    Creates a new project. The creator automatically becomes owner —
    unless it's created directly under a squad (team_id given), in
    which case access comes entirely from squad membership instead, so
    every current and future squad member has it automatically.
    """
    user_id = get_jwt_identity()
    data = request.get_json()

    name = data.get("name")
    if not name:
        return jsonify({"error": "name is required"}), 400

    team_id = data.get("team_id")
    if team_id is not None:
        squad_membership = TeamMember.query.filter_by(team_id=team_id, user_id=user_id).first()
        if not squad_membership:
            return jsonify({"error": "You are not a member of that squad"}), 403

    project = Project(
        name=name,
        description=data.get("description"),
        owner_id=user_id,
        team_id=team_id
    )
    db.session.add(project)
    db.session.flush()

    if team_id is None:
        owner_role = Role.query.filter_by(name="owner").first()
        if not owner_role:
            return jsonify({"error": "owner role not seeded yet — run seed_roles.py"}), 500

        membership = ProjectMember(
            project_id=project.id,
            user_id=user_id,
            role_id=owner_role.id
        )
        db.session.add(membership)

    db.session.commit()

    return jsonify(project.to_dict()), 201


@projects_bp.route("/projects/<int:project_id>", methods=["GET"])
@require_role("viewer")
def get_project(project_id):
    """Returns a single project's details, including the caller's role."""
    project = Project.query.get_or_404(project_id)
    data = project.to_dict()

    user_id = get_jwt_identity()
    data["my_role"] = get_effective_project_role(user_id, project_id)

    return jsonify(data), 200


@projects_bp.route("/projects/<int:project_id>", methods=["PUT"])
@require_role("editor")
def update_project(project_id):
    """Updates a project's name/description. Requires at least editor role."""
    project = Project.query.get_or_404(project_id)
    data = request.get_json()

    if "name" in data:
        project.name = data["name"]
    if "description" in data:
        project.description = data["description"]

    db.session.commit()
    return jsonify(project.to_dict()), 200


@projects_bp.route("/projects/<int:project_id>", methods=["DELETE"])
@require_role("owner")
def delete_project(project_id):
    """Deletes a project. Requires owner role."""
    project = Project.query.get_or_404(project_id)
    db.session.delete(project)
    db.session.commit()
    return jsonify({"message": "Project deleted"}), 200


@projects_bp.route("/projects/<int:project_id>/members", methods=["GET"])
@require_role("viewer")
def list_project_members(project_id):
    """
    Lists everyone with access to the project — direct invites plus,
    if this project belongs to a squad, everyone in that squad too.
    Any member (viewer+) can see this.
    """
    return jsonify(get_effective_members(project_id)), 200


@projects_bp.route("/projects/<int:project_id>/members", methods=["POST"])
@require_role("owner")
def add_project_member(project_id):
    """
    Invites a user to the project by email and assigns them a role.
    Only the project owner can do this. Creates a real notification for
    the invited user if this is a brand new membership (not just a role
    change for someone already on the project).
    Body: { "email": "someone@example.com", "role": "editor" }
    """
    data = request.get_json()
    email = data.get("email")
    role_name = data.get("role")

    if not email or not role_name:
        return jsonify({"error": "email and role are required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": f"No user found with email {email}"}), 404

    role = Role.query.filter_by(name=role_name).first()
    if not role:
        return jsonify({"error": f"'{role_name}' is not a valid role. Use viewer, editor, or owner"}), 400

    existing = ProjectMember.query.filter_by(project_id=project_id, user_id=user.id).first()
    if existing:
        existing.role_id = role.id
        db.session.commit()
        return jsonify({"message": f"Updated {email}'s role to {role_name}"}), 200

    membership = ProjectMember(project_id=project_id, user_id=user.id, role_id=role.id)
    db.session.add(membership)

    project = Project.query.get(project_id)
    if user.notifications_enabled:
        notification = Notification(
            user_id=user.id,
            type="invite",
            message=f"You were added to \"{project.name}\" as {role_name}.",
            project_id=project_id
        )
        db.session.add(notification)

    db.session.commit()

    return jsonify({"message": f"Added {email} to the project as {role_name}"}), 201


@projects_bp.route("/projects/<int:project_id>/validate", methods=["POST"])
@require_role("editor")
def toggle_project_validated(project_id):
    """Toggles whether a project is marked as validated / ready to ship."""
    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    project.is_validated = not project.is_validated
    db.session.commit()

    return jsonify(project.to_dict()), 200


@projects_bp.route("/projects/summary", methods=["GET"])
@jwt_required()
def project_summary():
    """
    Real counts for the Projects dashboard cards: how many active
    architectures the user has, how many AI-generated designs exist
    across them, and how many are marked validated.
    """
    user_id = get_jwt_identity()

    memberships = ProjectMember.query.filter_by(user_id=user_id).all()
    project_ids = [m.project_id for m in memberships]

    active_count = len(project_ids)

    ai_generated_count = 0
    validated_count = 0
    if project_ids:
        ai_generated_count = (
            Design.query
            .filter(Design.project_id.in_(project_ids))
            .filter(Design.prompt.isnot(None))
            .count()
        )
        validated_count = (
            Project.query
            .filter(Project.id.in_(project_ids))
            .filter(Project.is_validated.is_(True))
            .count()
        )

    return jsonify({
        "active_architectures": active_count,
        "ai_generated_designs": ai_generated_count,
        "validated_ready": validated_count
    }), 200