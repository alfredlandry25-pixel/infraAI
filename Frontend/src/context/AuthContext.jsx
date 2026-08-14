import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setAuthToken, clearAuthToken, setUnauthorizedHandler, STORAGE_KEY, toAbsoluteUrl } from "@/lib/api";

const AuthContext = createContext(null);

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

function loadStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.accessToken) {
      setAuthToken(parsed.accessToken);
      return parsed;
    }
  } catch {
    // ignore corrupted storage
  }
  return null;
}

function sessionFromUser(user, accessToken) {
  return {
    id: user.id,
    name: user.username,
    email: user.email,
    avatarUrl: toAbsoluteUrl(user.avatar_url) || null,
    role: user.role || "user",
    notificationsEnabled: user.notifications_enabled !== false,
    createdAt: user.created_at || null,
    accessToken,
  };
}

export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(() => loadStoredSession());
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(null);

  const persistSession = (sess) => {
    setSessionState(sess);
    if (sess) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sess));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const updateSession = (partial) => {
    setSessionState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const applyUserUpdate = (user) => {
    updateSession({
      name: user.username,
      email: user.email,
      avatarUrl: toAbsoluteUrl(user.avatar_url) || null,
      role: user.role || "user",
      notificationsEnabled: user.notifications_enabled !== false,
    });
  };

  const logout = () => {
    clearAuthToken();
    persistSession(null);
  };

  useEffect(() => {
    setUnauthorizedHandler(() => logout());
  }, []);

  const login = async (email, password) => {
    if (lockedUntil && Date.now() < lockedUntil) {
      const secs = Math.ceil((lockedUntil - Date.now()) / 1000);
      return { ok: false, error: `Too many attempts. Try again in ${secs}s.` };
    }

    try {
      const data = await api.post("/auth/login", { email: email.trim(), password });
      setAuthToken(data.access_token);
      setFailedAttempts(0);
      persistSession(sessionFromUser(data.user, data.access_token));
      return { ok: true };
    } catch (err) {
      const next = failedAttempts + 1;
      setFailedAttempts(next);
      if (next >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_MS);
        setFailedAttempts(0);
        return { ok: false, error: "Too many failed attempts. Locked for 30s." };
      }
      return { ok: false, error: err.message || "Invalid email or password." };
    }
  };

  const register = async (name, email, password) => {
    if (!name.trim() || !email.trim() || password.length < 8) {
      return { ok: false, error: "Please fill every required field with a valid value." };
    }

    try {
      const data = await api.post("/auth/signup", {
        username: name.trim(),
        email: email.trim(),
        password,
      });
      setAuthToken(data.access_token);
      persistSession(sessionFromUser(data.user, data.access_token));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message || "Something went wrong. Try again." };
    }
  };

  const value = useMemo(
    () => ({ session, isAuthenticated: !!session, failedAttempts, lockedUntil, login, register, logout, applyUserUpdate }),
    [session, failedAttempts, lockedUntil],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}