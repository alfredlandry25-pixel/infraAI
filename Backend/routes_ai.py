from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from decorators import require_role
from tasks import generate_design_task
from models import Design, Project, ProjectMember, Role, Conversation, Message
from doc_generator import generate_design_doc
from models_auth import db
from validate_design import validate_design
from ai_pipeline import generate_ai_response
import design_state

ai_bp = Blueprint("ai", __name__)


@ai_bp.route("/projects/<int:project_id>/generate", methods=["POST"])
@require_role("editor")
def generate_project_design(project_id):
    """
    Kicks off AI design generation for a project in the background.
    Returns immediately with a task_id — the actual design arrives
    later over the socket as a 'design_generated' event, in that
    project's room. Also creates a real notification for whoever
    triggered it once the generation finishes.

    Body: { "prompt": "a simple web app with a database" }
    """
    data = request.get_json(silent=True) or {}
    prompt = (data.get("prompt") or "").strip()

    if not prompt:
        return jsonify({"error": "prompt is required"}), 400

    user_id = get_jwt_identity()
    task = generate_design_task.delay(project_id, prompt, user_id)

    return jsonify({
        "message": "Design generation started",
        "task_id": task.id,
        "project_id": project_id
    }), 202


@ai_bp.route("/projects/<int:project_id>/doc/download", methods=["GET"])
@require_role("viewer")
def download_project_doc(project_id):
    """
    Generates and downloads a markdown documentation file for the most
    recently generated design on this project.
    """
    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404

    latest_design = (
        Design.query
        .filter_by(project_id=project_id)
        .order_by(Design.version.desc())
        .first()
    )
    if not latest_design:
        return jsonify({"error": "No design has been generated for this project yet"}), 404

    markdown_text = generate_design_doc(
        project_name=project.name,
        prompt=latest_design.prompt,
        design=latest_design.design_json,
        version=latest_design.version
    )

    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in project.name)
    filename = f"{safe_name}-architecture-v{latest_design.version}.md"

    return Response(
        markdown_text,
        mimetype="text/markdown",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@ai_bp.route("/projects/<int:project_id>/design", methods=["POST"])
@require_role("editor")
def save_project_design(project_id):
    """
    Manually saves a design for a project — used by Import, where the
    person uploads an existing design rather than generating one via AI.
    Creates a new version, same pattern as AI generation.
    Body: { "design": {"nodes": [...], "edges": [...]} }
    """
    data = request.get_json(silent=True) or {}
    design = data.get("design")

    if not design or "nodes" not in design or "edges" not in design:
        return jsonify({"error": "design with 'nodes' and 'edges' is required"}), 400

    try:
        validate_design(design)
    except Exception as e:
        return jsonify({"error": f"Invalid design: {e}"}), 400

    last = (
        Design.query
        .filter_by(project_id=project_id)
        .order_by(Design.version.desc())
        .first()
    )
    next_version = (last.version + 1) if last else 1

    new_design = Design(
        project_id=project_id,
        version=next_version,
        prompt=None,
        design_json=design
    )
    db.session.add(new_design)
    db.session.commit()

    return jsonify(new_design.to_dict()), 201


@ai_bp.route("/projects/<int:project_id>/design/latest", methods=["GET"])
@require_role("viewer")
def get_latest_design(project_id):
    """Returns the most recently saved design for a project — used by Export."""
    latest = (
        Design.query
        .filter_by(project_id=project_id)
        .order_by(Design.version.desc())
        .first()
    )
    if not latest:
        return jsonify({"error": "No design has been generated for this project yet"}), 404

    return jsonify(latest.to_dict()), 200


@ai_bp.route("/projects/<int:project_id>/designs", methods=["GET"])
@require_role("viewer")
def list_designs(project_id):
    """Returns the full version history (oldest first) for a project, including each version's prompt."""
    designs = (
        Design.query
        .filter_by(project_id=project_id)
        .order_by(Design.version.asc())
        .all()
    )
    return jsonify([d.to_dict() for d in designs]), 200


def _apply_ai_result(project_id, conversation_id, ai_result):
    """
    Shared logic for both chat endpoints below: given whatever
    generate_ai_response() returned, saves the right kind of Design +
    Message rows, and — if it was a design — keeps the live socket
    session and any other connected collaborators in sync, exactly like
    the async /generate path does.
    """
    if ai_result["type"] == "design":
        last = (
            Design.query
            .filter_by(project_id=project_id)
            .order_by(Design.version.desc())
            .first()
        )
        next_version = (last.version + 1) if last else 1

        new_design = Design(
            project_id=project_id,
            version=next_version,
            prompt=None,
            design_json=ai_result["design"]
        )
        db.session.add(new_design)
        db.session.flush()  # so new_design.id exists for the Message row below

        assistant_message = Message(
            conversation_id=conversation_id,
            role="assistant",
            type="design_card",
            content=ai_result["reply"],
            design_id=new_design.id
        )
        db.session.add(assistant_message)
        db.session.commit()

        design_state.set_state(project_id, next_version, ai_result["design"])

        from app import socketio
        socketio.emit("design_generated", {
            "project_id": project_id,
            "version": next_version,
            "design": ai_result["design"]
        }, room=str(project_id))

        return assistant_message

    assistant_message = Message(
        conversation_id=conversation_id,
        role="assistant",
        type="text",
        content=ai_result["reply"]
    )
    db.session.add(assistant_message)
    db.session.commit()
    return assistant_message


@ai_bp.route("/ai/chat/start", methods=["POST"])
@jwt_required()
def start_conversation():
    """
    The very first message of a brand new AI Generator conversation.
    Creates a real Project + Conversation together, saves the user's
    message, gets a real reply from the AI (chat or design — infraAI
    decides), and saves that too.
    Body: { "message": "..." }
    """
    data = request.get_json(silent=True) or {}
    message_text = (data.get("message") or "").strip()
    if not message_text:
        return jsonify({"error": "message is required"}), 400

    user_id = get_jwt_identity()

    owner_role = Role.query.filter_by(name="owner").first()
    if not owner_role:
        return jsonify({"error": "owner role not seeded yet — run seed_roles.py"}), 500

    project_name = message_text.strip().split("\n")[0][:60] or "Untitled Architecture"
    project = Project(name=project_name, description=message_text[:255], owner_id=user_id)
    db.session.add(project)
    db.session.flush()

    db.session.add(ProjectMember(project_id=project.id, user_id=user_id, role_id=owner_role.id))

    conversation = Conversation(project_id=project.id, user_id=user_id)
    db.session.add(conversation)
    db.session.flush()

    db.session.add(Message(conversation_id=conversation.id, role="user", type="text", content=message_text))
    db.session.commit()

    try:
        ai_result = generate_ai_response(message_text)
    except Exception as e:
        error_message = Message(conversation_id=conversation.id, role="assistant", type="error", content=str(e))
        db.session.add(error_message)
        db.session.commit()
        return jsonify({
            "project": project.to_dict(),
            "conversation": conversation.to_dict()
        }), 200

    _apply_ai_result(project.id, conversation.id, ai_result)
    db.session.refresh(conversation)

    return jsonify({
        "project": project.to_dict(),
        "conversation": conversation.to_dict()
    }), 201


@ai_bp.route("/projects/<int:project_id>/chat", methods=["POST"])
@require_role("editor")
def continue_conversation(project_id):
    """
    A follow-up message in an existing project's conversation. Reuses
    (or lazily creates, if this project predates the Conversation
    feature) the project's single Conversation, saves the message, gets
    a real reply grounded in the project's current design, and saves it.
    Body: { "message": "..." }
    """
    data = request.get_json(silent=True) or {}
    message_text = (data.get("message") or "").strip()
    if not message_text:
        return jsonify({"error": "message is required"}), 400

    user_id = get_jwt_identity()

    conversation = Conversation.query.filter_by(project_id=project_id).first()
    if not conversation:
        conversation = Conversation(project_id=project_id, user_id=user_id)
        db.session.add(conversation)
        db.session.flush()

    db.session.add(Message(conversation_id=conversation.id, role="user", type="text", content=message_text))
    db.session.commit()

    live_state = design_state.get_state(project_id)
    current_design = live_state.get("design") if live_state else None
    if current_design is None:
        last = (
            Design.query
            .filter_by(project_id=project_id)
            .order_by(Design.version.desc())
            .first()
        )
        current_design = last.design_json if last else None

    try:
        ai_result = generate_ai_response(message_text, current_design=current_design)
    except Exception as e:
        error_message = Message(conversation_id=conversation.id, role="assistant", type="error", content=str(e))
        db.session.add(error_message)
        db.session.commit()
        return jsonify(conversation.to_dict()), 200

    _apply_ai_result(project_id, conversation.id, ai_result)
    db.session.refresh(conversation)

    return jsonify(conversation.to_dict()), 200


@ai_bp.route("/projects/<int:project_id>/conversation", methods=["GET"])
@require_role("viewer")
def get_conversation(project_id):
    """Returns the full saved chat history for a project's AI Generator conversation, if one exists."""
    conversation = Conversation.query.filter_by(project_id=project_id).first()
    if not conversation:
        return jsonify(None), 200
    return jsonify(conversation.to_dict()), 200