"use client";
import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/context/theme-context";

export function Navbar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { theme, toggle } = useTheme();
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    // Set initial time
    const updateTime = () => {
      const now = new Date();
      const date = now.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const time = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      setCurrentTime(`${date} · ${time}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="surface border-b px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm muted">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <div className="text-sm muted font-mono">{currentTime}</div>
        <button
          onClick={toggle}
          className="p-2 rounded-lg surface border hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
