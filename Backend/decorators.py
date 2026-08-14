from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from models import ProjectMember, TeamMember, Project

# Role hierarchy: higher number = more permissions.
# "owner" can do anything an "editor" or "viewer" can, and so on.
ROLE_LEVELS = {
    "viewer": 1,
    "editor": 2,
    "owner": 3
}


def get_effective_project_role(user_id, project_id):
    """
    Returns the highest role a user effectively has on a project,
    combining two sources of access:
    - a direct ProjectMember row (an individual invite to this project), and
    - a TeamMember row for the project's squad, if the project belongs
      to one (Project.team_id) — squad membership grants every current
      AND future squad member access to every project under that squad,
      automatically, with their squad role.
    Returns None if neither grants any access at all.
    """
    best = None

    direct = ProjectMember.query.filter_by(project_id=project_id, user_id=user_id).first()
    if direct:
        best = direct.role_name

    project = Project.query.get(project_id)
    if project and project.team_id:
        team_membership = TeamMember.query.filter_by(
            team_id=project.team_id, user_id=user_id
        ).first()
        if team_membership:
            if best is None or ROLE_LEVELS.get(team_membership.role_name, 0) > ROLE_LEVELS.get(best, 0):
                best = team_membership.role_name

    return best


def get_effective_members(project_id):
    """
    Returns a deduped list of {user_id, email, username, role} for a
    project, combining direct ProjectMember rows with (if the project
    belongs to a squad) that squad's TeamMember rows. If someone has
    both a direct grant and squad access, the higher role wins.
    """
    project = Project.query.get(project_id)
    result = {}

    for m in ProjectMember.query.filter_by(project_id=project_id).all():
        result[m.user_id] = {
            "user_id": m.user_id, "email": m.user.email,
            "username": m.user.username, "role": m.role_name
        }

    if project and project.team_id:
        for m in TeamMember.query.filter_by(team_id=project.team_id).all():
            if m.user_id in result:
                if ROLE_LEVELS.get(m.role_name, 0) > ROLE_LEVELS.get(result[m.user_id]["role"], 0):
                    result[m.user_id]["role"] = m.role_name
            else:
                result[m.user_id] = {
                    "user_id": m.user_id, "email": m.user.email,
                    "username": m.user.username, "role": m.role_name
                }

    return list(result.values())


def get_effective_member_count(project_id):
    return len(get_effective_members(project_id))


def require_role(minimum_role):
    """
    Decorator for Flask routes that enforces project-level permissions.

    Usage:
        @app.route("/projects/<int:project_id>", methods=["DELETE"])
        @require_role("owner")
        def delete_project(project_id):
            ...

    Expects the route to have a `project_id` keyword argument (from the
    URL, e.g. <int:project_id>) so it knows WHICH project to check the
    user's role against.

    Requires a valid JWT (via Flask-JWT-Extended) identifying the user
    making the request.
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user_id = get_jwt_identity()

            project_id = kwargs.get("project_id")
            if project_id is None:
                return jsonify({"error": "require_role: no project_id found in route"}), 500

            role_name = get_effective_project_role(user_id, project_id)

            if role_name is None:
                return jsonify({"error": "You are not a member of this project"}), 403

            user_level = ROLE_LEVELS.get(role_name, 0)
            required_level = ROLE_LEVELS.get(minimum_role, 999)

            if user_level < required_level:
                return jsonify({
                    "error": f"This action requires '{minimum_role}' role or higher. "
                             f"Your role: '{role_name}'"
                }), 403

            return f(*args, **kwargs)
        return wrapper
    return decorator


def require_team_role(minimum_role):
    """
    Same idea as require_role, but for squads: enforces that the caller
    is a member of the team (from the route's <int:team_id>) with at
    least `minimum_role`.
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user_id = get_jwt_identity()

            team_id = kwargs.get("team_id")
            if team_id is None:
                return jsonify({"error": "require_team_role: no team_id found in route"}), 500

            membership = TeamMember.query.filter_by(
                team_id=team_id,
                user_id=user_id
            ).first()

            if not membership:
                return jsonify({"error": "You are not a member of this squad"}), 403

            user_level = ROLE_LEVELS.get(membership.role_name, 0)
            required_level = ROLE_LEVELS.get(minimum_role, 999)

            if user_level < required_level:
                return jsonify({
                    "error": f"This action requires '{minimum_role}' role or higher. "
                             f"Your role: '{membership.role_name}'"
                }), 403

            return f(*args, **kwargs)
        return wrapper
    return decorator