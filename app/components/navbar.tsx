"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Moon, Sun, Settings, LayoutDashboard, EyeOff } from "lucide-react";
import { useTheme } from "@/app/context/theme-context";
import { useDashboardVisibility } from "@/app/context/dashboard-context";
import { routes } from "@/lib/routes";

export function Navbar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { theme, toggle } = useTheme();
  const { showGlobalDashboards, toggleGlobalDashboards } = useDashboardVisibility();
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
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden sm:block text-sm muted font-mono">{currentTime}</div>
        <button
          onClick={toggleGlobalDashboards}
          className={`px-2.5 py-1.5 rounded-lg surface border hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-1.5 text-xs font-medium transition-colors ${
            !showGlobalDashboards ? "text-amber-500 border-amber-500/30 bg-amber-500/10" : ""
          }`}
          aria-label={showGlobalDashboards ? "Hide all page dashboards" : "Show all page dashboards"}
          title={showGlobalDashboards ? "Hide all page dashboards" : "Show all page dashboards"}
        >
          {showGlobalDashboards ? <LayoutDashboard size={15} /> : <EyeOff size={15} />}
          <span className="hidden md:inline">
            {showGlobalDashboards ? "Hide Dashboards" : "Show Dashboards"}
          </span>
        </button>
        <Link
          href={routes.settings}
          className="p-2 rounded-lg surface border hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Settings"
          title="Settings"
        >
          <Settings size={16} />
        </Link>
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
