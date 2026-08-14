import socketio
import time

sio = socketio.Client()

PROJECT_ID = "project-123"


@sio.on("design_updated")
def on_updated(data):
    print("Server confirmed design_updated:", data)


@sio.on("design_conflict")
def on_conflict(data):
    print("Conflict:", data)


sio.connect("http://localhost:5000")
sio.emit("join_project", {"project_id": PROJECT_ID})
time.sleep(1)

print("\nSimulating an AI-generated design (as if Kelly's Celery task emitted this)...")


CURRENT_VERSION = 0

sio.emit("design_update", {
    "project_id": PROJECT_ID,
    "version": CURRENT_VERSION,
    "design": {
        "nodes": [
            {"id": "1", "type": "ec2", "label": "AI Generated Web Server"},
            {"id": "2", "type": "database", "label": "AI Generated DB"}
        ],
        "edges": [
            {"from": "1", "to": "2", "label": "connects to"}
        ]
    }
})

time.sleep(1)
sio.disconnect()
print("\nDone. Check your browser tab -- it should have updated automatically.")