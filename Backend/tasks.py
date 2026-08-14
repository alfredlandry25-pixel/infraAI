import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
from flask_socketio import SocketIO
from celery_app import celery
from ai_pipeline import generate_design
import design_state

load_dotenv()
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

socketio_emit_client = SocketIO(message_queue=REDIS_URL)


@celery.task(name="tasks.generate_design_task")
def generate_design_task(project_id, prompt, user_id=None):
    print(f"[Celery] Generating design for project {project_id}, prompt: {prompt}")

    from app import app
    from models_auth import db
    from models import Design, Notification, Project

    live_state = design_state.get_state(project_id)
    current_design = live_state["design"] if live_state.get("design") else None

    if current_design is None:
        with app.app_context():
            last = (
                Design.query
                .filter_by(project_id=project_id)
                .order_by(Design.version.desc())
                .first()
            )
            current_design = last.design_json if last else None

    try:
        design = generate_design(prompt, current_design=current_design)
    except Exception as e:
        print(f"[Celery] generate_design failed: {e}")
        socketio_emit_client.emit("design_generation_failed", {
            "project_id": project_id,
            "error": str(e)
        }, room=str(project_id))
        return

    print(f"[Celery] Design generated, saving to database for project {project_id}")

    with app.app_context():
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
            prompt=prompt,
            design_json=design,
            created_by=user_id
        )
        db.session.add(new_design)

        if user_id is not None:
            project = Project.query.get(project_id)
            from models_auth import User
            requester = User.query.get(user_id)
            if requester and requester.notifications_enabled:
                notification = Notification(
                    user_id=user_id,
                    type="generation_complete",
                    message=f"Your AI design for \"{project.name if project else project_id}\" is ready.",
                    project_id=project_id
                )
                db.session.add(notification)

        db.session.commit()
        print(f"[Celery] Saved as Design id={new_design.id}, version={next_version}")

    new_state = design_state.set_state(project_id, next_version, design)

    print(f"[Celery] Emitting design_generated to room {project_id}")
    socketio_emit_client.emit("design_generated", {
        "project_id": project_id,
        "version": next_version,
        "design": design
    }, room=str(project_id))

    return design