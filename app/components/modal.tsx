"use client";
import { X } from "lucide-react";

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: ()=>void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="surface border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"><X size={16}/></button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="p-4 border-t flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wider muted mb-1">{label}</div>
      {children}
    </label>
  );
}

export const inputCls = "w-full surface border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";
