import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { getAuthToken } from "@/lib/api";

const SOCKET_URL = "http://localhost:5000";

export function useCollabSocket(projectId) {
  const socketRef = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [design, setDesign] = useState(null);
  const [version, setVersion] = useState(0);
  const [conflict, setConflict] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [comments, setComments] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [permissionError, setPermissionError] = useState(null);
  const [joinError, setJoinError] = useState(null);

  useEffect(() => {
    if (!projectId) return;

    // The JWT goes in the handshake `auth` payload (not a header) since
    // Socket.IO connections aren't plain HTTP requests. The backend
    // decodes it in socket_auth.py to know who's dragging/editing, so a
    // viewer can be blocked from design_update the same way they're
    // already blocked from POST /generate.
    const socket = io(SOCKET_URL, {
      auth: { token: getAuthToken() },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join_project", { project_id: projectId });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("joined_project", (data) => {
      if (data.project_id === projectId) {
        setDesign(data.design);
        setVersion(data.version);
        setMyRole(data.my_role);
      }
    });

    socket.on("join_rejected", (data) => {
      if (data.project_id === projectId) {
        setJoinError(data.error || "You can't access this project");
      }
    });

    socket.on("presence_update", (data) => {
      if (data.project_id === projectId) {
        setOnlineCount(data.online_count);
      }
    });

    socket.on("design_updated", (data) => {
      if (data.project_id === projectId) {
        setDesign(data.design);
        setVersion(data.version);
        setConflict(null);
      }
    });

    socket.on("design_conflict", (data) => {
      if (data.project_id === projectId) {
        setConflict({
          currentVersion: data.current_version,
          currentDesign: data.current_design
        });
        setDesign(data.current_design);
        setVersion(data.current_version);
      }
    });

    // A viewer's drag was rejected server-side (defense in depth — the
    // canvas should already be locked for them, see Canvas.jsx readOnly).
    socket.on("design_update_rejected", (data) => {
      if (String(data.project_id) === String(projectId)) {
        setPermissionError(data.error || "You don't have permission to edit this project");
      }
    });

    socket.on("design_generated", (data) => {
      if (String(data.project_id) === String(projectId)) {
        setDesign(data.design);
        setVersion(data.version);
        setGenerating(false);
        setGenerationError(null);
      }
    });

    socket.on("design_generation_failed", (data) => {
      if (String(data.project_id) === String(projectId)) {
        setGenerating(false);
        setGenerationError(data.error || "Design generation failed");
      }
    });

    socket.on("comment_added", (data) => {
      if (String(data.project_id) === String(projectId)) {
        setComments((prev) => [...prev, data]);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [projectId]);

  const sendDesignUpdate = useCallback((newDesign) => {
    if (!socketRef.current) return;
    socketRef.current.emit("design_update", {
      project_id: projectId,
      version: version,
      design: newDesign
    });
  }, [projectId, version]);

  return {
    isConnected,
    onlineCount,
    design,
    version,
    conflict,
    sendDesignUpdate,
    generating,
    setGenerating,
    generationError,
    comments,
    setComments,
    myRole,
    permissionError,
    setPermissionError,
    joinError
  };
}