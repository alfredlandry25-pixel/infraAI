"""
Shared live-design state for the collaboration socket.

app.py (the Flask-SocketIO process) and tasks.py (the Celery worker,
a *separate* process) both need to read and write the same "current
version + current design" for a project's live session. A plain Python
dict only lives inside one process's memory, so the two could never
agree — that's the exact bug where an AI-generated design would go out
to clients over the socket but never register in the socket server's
own version tracker, letting a subsequent manual edit silently stomp on
it. Redis is already running (docker-compose) and already used for the
socket message queue and Celery broker, so it's the natural shared
store for this too.
"""

import json
import os
import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)


def _key(project_id):
    return f"design_state:{project_id}"


def get_state(project_id):
    """Returns {'version': int, 'design': dict}, defaulting to v0/empty."""
    raw = _client.get(_key(project_id))
    if not raw:
        return {"version": 0, "design": {}}
    return json.loads(raw)


def set_state(project_id, version, design):
    """Overwrites the live state for a project with an explicit version."""
    state = {"version": version, "design": design}
    _client.set(_key(project_id), json.dumps(state))
    return state


def bump_state(project_id, design):
    """
    Increments the version for a manual live edit. Caller is expected
    to have already checked the client's version against get_state()
    before calling this (see handle_design_update in app.py).
    """
    current = get_state(project_id)
    new_version = current["version"] + 1
    return set_state(project_id, new_version, design)