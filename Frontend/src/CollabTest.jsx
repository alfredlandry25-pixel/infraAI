import { useCollabSocket } from "./hooks/useCollabSocket";

function CollabTest() {
  const {
    isConnected,
    onlineCount,
    design,
    version,
    conflict,
    sendDesignUpdate
  } = useCollabSocket("project-123");

  const handleSendTestEdit = () => {
    sendDesignUpdate({
      nodes: [{ id: "1", type: "ec2", label: "Test Server " + Date.now() }],
      edges: []
    });
  };

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h2>Collab Socket Test</h2>
      <p>Connected: {isConnected ? "✅ yes" : "❌ no"}</p>
      <p>Online in this project: {onlineCount}</p>
      <p>Current version: {version}</p>
      <p>Conflict: {conflict ? "⚠️ yes" : "none"}</p>

      <button onClick={handleSendTestEdit}>
        Send Test Edit
      </button>

      <h3>Current Design:</h3>
      <pre>{JSON.stringify(design, null, 2)}</pre>
    </div>
  );
}

export default CollabTest;