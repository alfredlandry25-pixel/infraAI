import eventlet
eventlet.monkey_patch()

# Then import everything else
from flask import Flask
# ... rest of imports

import os
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from models_auth import db, User, Role
from models import Project, ProjectMember
from dotenv import load_dotenv
from flask import Flask, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
from datetime import timedelta
import design_state
import socket_auth
load_dotenv()

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173"], supports_credentials=True)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-change-later")
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-change-later")

db.init_app(app)

from routes_projects import projects_bp
app.register_blueprint(projects_bp)

from routes_auth import auth_bp
app.register_blueprint(auth_bp, url_prefix="/auth")

from routes_ai import ai_bp
app.register_blueprint(ai_bp)

from routes_comments import comments_bp
app.register_blueprint(comments_bp)

from routes_teams import teams_bp
app.register_blueprint(teams_bp)

from routes_dashboard import dashboard_bp
app.register_blueprint(dashboard_bp)

from routes_notifications import notifications_bp
app.register_blueprint(notifications_bp)

from routes_documents import documents_bp
app.register_blueprint(documents_bp)

migrate = Migrate(app, db)
jwt = JWTManager(app)
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=24)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


socketio = SocketIO(app, cors_allowed_origins="*", message_queue=REDIS_URL)
# Presence (who's online) is fine to keep per-process in memory — each
# socket connection lives on exactly this process. The design version
# tracker, though, now lives in Redis (see design_state.py) so this
# process and the Celery worker process agree on the current version
# even when AI generation updates it from outside this process.
project_presence = {}

# sid -> user_id (set on connect, from the JWT the client sends in the
# handshake) and sid -> role (set on join_project, since that's when we
# first know which project this connection cares about). Both are used
# to enforce that only editor+ can push design_update — a viewer could
# otherwise drag nodes around even though they can't trigger AI
# generation (that's already blocked at the REST layer).
sid_user = {}
sid_role = {}


@app.route("/health")
def health():
    return {"status": "ok"}


@socketio.on("connect")
def handle_connect(auth):
    print("Client connected")
    user_id = socket_auth.get_user_id_from_auth(auth)
    if user_id is not None:
        sid_user[request.sid] = user_id
    emit("echo", {"message": "connected to InfraAI socket server"})


@socketio.on("test_echo")
def handle_test_echo(data):
    print("Received test_echo:", data)
    emit("echo", {"message": f"echo: {data}"})

@socketio.on("join_project")
def handle_join_project(data):
    project_id = data.get("project_id")

    user_id = sid_user.get(request.sid)
    role = socket_auth.get_project_role(user_id, project_id)
    if role is None:
        print(f"Rejected join: {request.sid} is not a member of project {project_id}")
        emit("join_rejected", {
            "project_id": project_id,
            "error": "You are not a member of this project"
        })
        return
    sid_role[request.sid] = role

    join_room(project_id)

    if project_id not in project_presence:
        project_presence[project_id] = set()
    project_presence[project_id].add(request.sid)

    print(f"Client {request.sid} joined project room: {project_id} as {role}")
    current = design_state.get_state(project_id)
    emit("joined_project", {
        "project_id" : project_id,
        "version": current["version"],
        "design": current["design"],
        "my_role": role
        })

    emit("presence_update", {
        "project_id": project_id,
        "online_count": len(project_presence[project_id])

    }, to=project_id)

@socketio.on("design_update")
def handle_design_update(data):
    project_id = data.get("project_id")
    client_version = data.get("version")
    new_design = data.get("design")
    print(f"design_update received for {project_id}: client version={client_version}")

    role = sid_role.get(request.sid)
    if not socket_auth.role_at_least(role, "editor"):
        print(f"design_update REJECTED for {project_id}: {request.sid} has role '{role}', needs editor+")
        emit("design_update_rejected", {
            "project_id": project_id,
            "error": f"This action requires 'editor' role or higher. Your role: '{role}'"
        })
        return

    current = design_state.get_state(project_id)
    print(f" current design_state: {current}")

    if client_version != current["version"]:
        print(f"design_update REJECTED for {project_id}: client had v{client_version}, server has v{current['version']}")
        emit("design_conflict", {
            "project_id": project_id,
            "current_version": current["version"],
            "current_design": current["design"]
        })
        return

    new_state = design_state.bump_state(project_id, new_design)
    new_version = new_state["version"]
    print(f"design_update ACCEPTED for {project_id}: now v{new_version}")

    emit("design_updated", {
         "project_id": project_id,
         "version": new_version,
         "design": new_design
    }, to=project_id)



@socketio.on("disconnect")
def handle_disconnect():
    sid = request.sid
    print(f"Client disconnected: {sid}")
    sid_user.pop(sid, None)
    sid_role.pop(sid, None)
    for project_id, members in list(project_presence.items()):
        if sid in members:
            members.discard(sid)
            print(f"Client {sid} left project room: {project_id}")

            emit("presence_update", {
                "project_id": project_id,
                "online_count": len(members)
            }, to=project_id)

            if len(members) == 0:
                del project_presence[project_id]


if __name__ == "__main__":

    socketio.run(app, debug=True, port=5000, use_reloader=False)