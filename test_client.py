import socketio

sio = socketio.Client()


@sio.event
def connect():
    print("Connected to server!")
    sio.emit("test_echo", {"hello": "from client"})


@sio.on("echo")
def on_echo(data):
    print("Got echo back:", data)


sio.connect("http://localhost:5000")
sio.wait()