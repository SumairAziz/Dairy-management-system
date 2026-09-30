"use client";

import { useState, useEffect, type ReactNode } from "react";
import { ChevronDown, ChevronUp, LayoutDashboard } from "lucide-react";
import { useDashboardVisibility } from "@/app/context/dashboard-context";

export interface CollapsibleDashboardProps {
  /** Unique key to persist expanded/collapsed state in localStorage (e.g. "terradairy:dashboard:breeding") */
  storageKey?: string;
  /** Section title displayed in header */
  title?: string;
  /** Initial state if no localStorage preference is found */
  defaultExpanded?: boolean;
  /** Optional actions/elements rendered on the right side of header */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

interface LocalDashboardState {
  isExpanded: boolean;
  updatedAt: number;
}

export function CollapsibleDashboard({
  storageKey,
  title,
  defaultExpanded = true,
  action,
  children,
  className = "",
}: CollapsibleDashboardProps) {
  const { globalState } = useDashboardVisibility();

  const [localState, setLocalState] = useState<LocalDashboardState>(() => ({
    isExpanded: defaultExpanded,
    updatedAt: 0,
  }));

  // Load local state from localStorage on mount
  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        try {
          const parsed = JSON.parse(stored);
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            typeof parsed.isExpanded === "boolean"
          ) {
            setLocalState({
              isExpanded: parsed.isExpanded,
              updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
            });
            return;
          }
        } catch {
          // Handle legacy boolean
        }
        if (stored === "true" || stored === "false") {
          setLocalState({
            isExpanded: stored === "true",
            updatedAt: 0,
          });
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [storageKey]);

  // Determine effective expansion: if local user interaction is newer than last global toggle, use local state; otherwise follow global state
  const isExpanded =
    localState.updatedAt > globalState.updatedAt
      ? localState.isExpanded
      : globalState.type === "show";

  const toggle = () => {
    const nextExpanded = !isExpanded;
    const nextState: LocalDashboardState = {
      isExpanded: nextExpanded,
      updatedAt: Date.now(),
    };
    setLocalState(nextState);

    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(nextState));
      } catch {
        // Ignore localStorage errors
      }
    }
  };

  const contentId = storageKey
    ? `dashboard-${storageKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`
    : "collapsible-dashboard-content";

  return (
    <section className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-3 px-0.5">
        <div className="flex items-center gap-2.5">
          {title && (
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
              <LayoutDashboard size={14} className="text-brand-500" />
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={isExpanded ? "Hide Dashboard" : "Show Dashboard"}
            title={isExpanded ? "Hide Summary Dashboard" : "Show Summary Dashboard"}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium surface border hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all duration-150 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
          >
            {isExpanded ? (
              <>
                <ChevronUp size={14} />
                <span>Hide Dashboard</span>
              </>
            ) : (
              <>
                <ChevronDown size={14} />
                <span>Show Dashboard</span>
              </>
            )}
          </button>
        </div>

        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>

      <div
        id={contentId}
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded
            ? "max-h-[3000px] opacity-100"
            : "max-h-0 opacity-0 pointer-events-none"
        }`}
      >
        {children}
      </div>
    </section>
  );
}
