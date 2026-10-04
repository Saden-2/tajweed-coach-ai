"use client";

import { useEffect, useState } from "react";

/**
 * Night mode toggle (الوضع الليلي). Adds/removes the `dark` class on <html>;
 * the actual look is defined in globals.css. The choice is remembered in
 * localStorage (wrapped in try/catch - it can be unavailable).
 */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("theme") === "dark") {
        document.documentElement.classList.add("dark");
        setDark(true);
      }
    } catch {
      /* storage unavailable - stay in light mode */
    }
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "الوضع النهاري" : "الوضع الليلي"}
      title={dark ? "الوضع النهاري / Light mode" : "الوضع الليلي / Night mode"}
      className="fixed bottom-4 left-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-[#e4e0d5] bg-white text-xl shadow-md transition hover:scale-105"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
