"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "terradairy:dashboard:global_state";

export type GlobalDashboardState = {
  type: "show" | "hide";
  updatedAt: number;
};

type DashboardVisibilityContextValue = {
  globalState: GlobalDashboardState;
  showGlobalDashboards: boolean;
  setGlobalAction: (type: "show" | "hide") => void;
  toggleGlobalDashboards: () => void;
};

const defaultGlobalState: GlobalDashboardState = {
  type: "show",
  updatedAt: 0,
};

const DashboardVisibilityContext = createContext<DashboardVisibilityContextValue>({
  globalState: defaultGlobalState,
  showGlobalDashboards: true,
  setGlobalAction: () => {},
  toggleGlobalDashboards: () => {},
});

export function DashboardVisibilityProvider({ children }: { children: ReactNode }) {
  const [globalState, setGlobalState] = useState<GlobalDashboardState>(defaultGlobalState);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        try {
          const parsed = JSON.parse(saved);
          if (
            parsed &&
            (parsed.type === "show" || parsed.type === "hide") &&
            typeof parsed.updatedAt === "number"
          ) {
            setGlobalState(parsed);
            return;
          }
        } catch {
          // Handle legacy boolean
        }
        if (saved === "true" || saved === "false") {
          setGlobalState({
            type: saved === "true" ? "show" : "hide",
            updatedAt: Date.now(),
          });
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const setGlobalAction = (type: "show" | "hide") => {
    const next: GlobalDashboardState = { type, updatedAt: Date.now() };
    setGlobalState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore localStorage errors
    }
  };

  const toggleGlobalDashboards = () => {
    setGlobalAction(globalState.type === "show" ? "hide" : "show");
  };

  return (
    <DashboardVisibilityContext.Provider
      value={{
        globalState,
        showGlobalDashboards: globalState.type === "show",
        setGlobalAction,
        toggleGlobalDashboards,
      }}
    >
      {children}
    </DashboardVisibilityContext.Provider>
  );
}

export const useDashboardVisibility = () => useContext(DashboardVisibilityContext);
