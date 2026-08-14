const API_BASE_URL = "http://localhost:5000";
const STORAGE_KEY = "infraai_session";

let currentToken = null;
let onUnauthorized = null;

export function setAuthToken(token) {
  currentToken = token;
}

export function clearAuthToken() {
  currentToken = null;
}

export function getAuthToken() {
  return currentToken;
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (currentToken) {
    headers["Authorization"] = `Bearer ${currentToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Some responses (like file downloads) aren't JSON.
  }

  if (response.status === 401 && onUnauthorized) {
    onUnauthorized();
  }

  if (!response.ok) {
    const message = data?.error || `Request failed with status ${response.status}`;
    const err = new Error(message);
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  put: (path, body) => request("PUT", path, body),
  patch: (path, body) => request("PATCH", path, body),
  del: (path) => request("DELETE", path),
};

export async function uploadFile(path, fieldName, file, extraFields = {}) {
  const formData = new FormData();
  formData.append(fieldName, file);
  Object.entries(extraFields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      formData.append(key, value);
    }
  });

  const headers = {};
  if (currentToken) headers["Authorization"] = `Bearer ${currentToken}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // ignore
  }

  if (!response.ok) {
    const message = data?.error || `Upload failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export function toAbsoluteUrl(path) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE_URL}${path}`;
}

export async function downloadFile(path, filename) {
  const headers = {};
  if (currentToken) headers["Authorization"] = `Bearer ${currentToken}`;

  const response = await fetch(`${API_BASE_URL}${path}`, { headers });

  if (!response.ok) {
    let message = `Download failed with status ${response.status}`;
    try {
      const data = await response.json();
      message = data?.error || message;
    } catch {
      // response wasn't JSON, keep the default message
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export { API_BASE_URL, STORAGE_KEY };