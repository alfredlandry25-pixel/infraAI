from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from decorators import require_role, get_effective_members
from models_auth import db, User
from models import Comment, Project, Notification

comments_bp = Blueprint("comments", __name__)


@comments_bp.route("/projects/<int:project_id>/comments", methods=["GET"])
@require_role("viewer")
def list_comments(project_id):
    """Returns the full comment feed for a project, oldest first."""
    comments = (
        Comment.query
        .filter_by(project_id=project_id)
        .order_by(Comment.created_at.asc())
        .all()
    )
    return jsonify([c.to_dict() for c in comments]), 200


@comments_bp.route("/projects/<int:project_id>/comments", methods=["POST"])
@require_role("viewer")
def post_comment(project_id):
    """
    Posts a new comment, pushes it live to everyone currently viewing the
    project via the socket, and creates a real notification for every
    other member of the project (not the commenter themselves).
    Body: { "content": "some message" }
    """
    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    data = request.get_json(silent=True) or {}
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"error": "content is required"}), 400

    user_id = get_jwt_identity()

    comment = Comment(project_id=project_id, user_id=user_id, content=content)
    db.session.add(comment)
    db.session.flush()

    other_members = [
        m for m in get_effective_members(project_id)
        if m["user_id"] != user_id
    ]
    preview = content if len(content) <= 60 else content[:57] + "..."
    for member in other_members:
        recipient = User.query.get(member["user_id"])
        if not recipient or not recipient.notifications_enabled:
            continue
        db.session.add(Notification(
            user_id=member["user_id"],
            type="comment",
            message=f"{comment.user.username} commented on \"{project.name}\": {preview}",
            project_id=project_id
        ))

    db.session.commit()

    comment_data = comment.to_dict()

    from app import socketio
    socketio.emit("comment_added", comment_data, room=str(project_id))

    return jsonify(comment_data), 201