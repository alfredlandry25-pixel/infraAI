import { useEffect, useState } from "react";

const KEY = "infraai-theme";

function apply(theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    let saved = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      // localStorage can throw in private-browsing / disabled-storage contexts — fail safe.
    }
    const initial = saved === "light" || saved === "dark" ? saved : "dark";
    setTheme(initial);
    apply(initial);
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      apply(next);
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // Non-fatal: theme just won't persist across reloads.
      }
      return next;
    });
  };

  return { theme, toggle };
}
