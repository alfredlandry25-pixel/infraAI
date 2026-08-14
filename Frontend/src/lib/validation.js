/**
 * Small, dependency-free validation & sanitization helpers used across every form
 * in the app. Centralizing this avoids ad-hoc regexes scattered through components
 * (and the inconsistent escaping bugs that come with that).
 */

// RFC 5322-ish, deliberately conservative — good enough for client-side UX validation.
// The server is always the source of truth for real email verification.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return EMAIL_RE.test(value.trim()) && value.length <= 254;
}

export function passwordStrength(value) {
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;

  if (value.length < 8) return { score: 0, label: "Too short" };
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  return { score, label: labels[score] };
}

/**
 * Strips control characters and trims whitespace from free-text input before it's
 * stored in component state. This is defense-in-depth, not a substitute for React's
 * built-in output-escaping (which already prevents injected markup from rendering).
 */
export function sanitizeText(value, maxLength = 500) {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

/** Very small allow-list check used before treating a string as a safe redirect target. */
export function isSafeInternalPath(path) {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("://");
}
