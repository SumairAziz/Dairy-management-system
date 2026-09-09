"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type ToastKind = "info" | "success" | "error";

type ToastState = {
  message: string;
  kind: ToastKind;
} | null;

type ExportToastContextValue = {
  showToast: (message: string, kind?: ToastKind) => void;
};

const ExportToastContext = createContext<ExportToastContextValue | null>(null);

export function ExportToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = useCallback((message: string, kind: ToastKind = "info") => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ExportToastContext.Provider value={value}>
      {children}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg surface text-sm max-w-sm animate-in fade-in slide-in-from-bottom-2"
        >
          {toast.kind === "success" && (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          )}
          {toast.kind === "error" && (
            <AlertCircle size={16} className="text-red-400 shrink-0" />
          )}
          {toast.kind === "info" && (
            <Loader2 size={16} className="text-brand-400 shrink-0 animate-spin" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </ExportToastContext.Provider>
  );
}

export function useExportToast() {
  const ctx = useContext(ExportToastContext);
  if (!ctx) {
    return {
      showToast: (message: string) => {
        if (typeof window !== "undefined") {
          // Fallback when provider is not mounted.
          console.info(message);
        }
      },
    };
  }
  return ctx;
}
