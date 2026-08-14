import socketio
import time
import sys

client_name = sys.argv[1] if len(sys.argv) > 1 else "Developer"

sio = socketio.Client()

@sio.event
def connect():
    print(f"[{client_name}] Connected to server!")
    sio.emit("join_project", {"project_id" : "project-123"})


@sio.on("joined_project")
def on_joined(data):
    print(f"[{client_name}] joined project : ", data)


@sio.on("presence_update")
def on_presence(data):
    print(f"[{client_name}] presence update : ", data)

sio.connect("http://localhost:5000")
sio.wait()

