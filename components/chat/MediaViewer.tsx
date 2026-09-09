"use client";

import { useEffect } from "react";
import { Download, X } from "lucide-react";
import { formatMediaDuration } from "@/lib/chat/format";

export type MediaViewerItem = {
  kind: "image" | "video" | "file";
  url: string;
  downloadUrl: string;
  fileName: string;
  mimeType?: string;
  durationSeconds?: number | null;
};

export function MediaViewer({
  item,
  onClose,
}: {
  item: MediaViewerItem;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
    >
      <div
        className="relative flex max-h-full max-w-full flex-col items-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute right-0 top-0 z-10 flex items-center gap-2">
          <a
            href={item.downloadUrl}
            download={item.fileName}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-white/10 px-3 text-sm text-white hover:bg-white/20"
          >
            <Download size={16} />
            Download
          </a>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {item.kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt={item.fileName}
            className="max-h-[85vh] max-w-[min(96vw,1200px)] rounded-lg object-contain"
          />
        )}

        {item.kind === "video" && (
          <video
            src={item.url}
            controls
            autoPlay
            playsInline
            className="max-h-[85vh] max-w-[min(96vw,1200px)] rounded-lg bg-black"
          />
        )}

        {item.kind === "file" && item.mimeType === "application/pdf" && (
          <iframe
            src={item.url}
            title={item.fileName}
            className="mt-12 h-[85vh] w-[min(96vw,900px)] rounded-lg bg-white"
          />
        )}

        {item.kind === "file" && item.mimeType !== "application/pdf" && (
          <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 px-8 py-10 text-center text-white">
            <p className="font-medium">{item.fileName}</p>
            <p className="mt-2 text-sm text-white/70">Preview not available for this file type.</p>
            <a
              href={item.downloadUrl}
              download={item.fileName}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white"
            >
              <Download size={16} />
              Download file
            </a>
          </div>
        )}

        <p className="mt-3 max-w-[min(96vw,1200px)] truncate text-center text-sm text-white/80">
          {item.fileName}
          {item.kind === "video" && item.durationSeconds
            ? ` · ${formatMediaDuration(item.durationSeconds)}`
            : ""}
        </p>
      </div>
    </div>
  );
}
