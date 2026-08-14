"""
Auth helpers for the Socket.IO layer.

HTTP routes get their role checks for free via decorators.require_role,
which reads the JWT off the request's Authorization header. Socket.IO
events have no such header — the JWT has to be sent explicitly during
the handshake (see the frontend's `io(SOCKET_URL, { auth: { token } })`
call) and decoded here instead.
"""

from flask_jwt_extended import decode_token
from models import ProjectMember

ROLE_LEVELS = {"viewer": 1, "editor": 2, "owner": 3}


def get_user_id_from_auth(auth):
    """
    `auth` is the dict the client passes as the second arg to `io()`,
    e.g. {"token": "<jwt>"}. Returns the user id encoded in the token,
    or None if there's no token or it's invalid/expired.
    """
    if not auth or not auth.get("token"):
        return None
    try:
        decoded = decode_token(auth["token"])
        return decoded.get("sub")
    except Exception:
        return None


def get_project_role(user_id, project_id):
    """
    Returns the user's effective role_name for a project, combining
    direct ProjectMember access with squad (TeamMember) access if the
    project belongs to a squad — see decorators.get_effective_project_role.
    """
    if user_id is None:
        return None
    from decorators import get_effective_project_role
    return get_effective_project_role(user_id, project_id)


def role_at_least(role_name, minimum_role):
    return ROLE_LEVELS.get(role_name, 0) >= ROLE_LEVELS.get(minimum_role, 999)