import socketio
import time

ahmed = socketio.Client()
salim = socketio.Client()

PROJECT_ID = "developer-237"

@ahmed.on("design_updated")
def ahmed_updated(data):
    print(f"[AHMED] design_updated received: version={data['version']}, design={data["design"]}")

@ahmed.on("design_conflict")
def ahmed_conflict(data):
    print(f"[AHMED] CONFLICT! current_version={data['current_version']}, current_design={data['current_design']}")

@salim.on ("design_updated")
def salim_updated(data):
    print(f"[salim] design updated received: version={data['version']}, design={data['design']}")  

@salim.on("design_conflict")
def salim_conflict(data):
    print(f"[salim] CONFLICT! current_version={data['current_version']}, current_design={data['current_design']}") 

print("connecting both developers...")
ahmed.connect("http://localhost:5000")
salim.connect("http://localhost:5000")

ahmed.emit("join_project", {"project_id": PROJECT_ID})
salim.emit("join_project", {"project_id": PROJECT_ID})

time.sleep(1)

print("\n ahmed saves first, editing version 0")
ahmed.emit("design_update", {
    "project_id": PROJECT_ID,
    "version": 0,
    "design" : {"nodes": ["database"]}
})
time.sleep(1)

print("\n salim saves next, but he's still editing version 0 (stale!)")
salim.emit("design_update",{
    "project_id": PROJECT_ID,
    "version": 0,
    "design":{"nodes":["ec2_deleted"]}
})

time.sleep(1)

print("\n salim retries correctly, now editing version 1 ")
salim.emit("design_update",{
    "project_id": PROJECT_ID,
    "version": 1,
    "design":{"nodes": ["database", "ec2_deleted"]}
})

time.sleep(1)

print("\n Done testing design update conflicts. Disconnecting both developers...")
ahmed.disconnect()
salim.disconnect()
