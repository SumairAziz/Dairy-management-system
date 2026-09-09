"use client";

import { Download, FileText, Play } from "lucide-react";
import type { ChatAttachmentDto } from "@/services/chat.service";
import { formatFileSize, formatMediaDuration } from "@/lib/chat/format";
import type { MediaViewerItem } from "./MediaViewer";

export function ChatMediaAttachment({
  attachment,
  mine,
  onOpen,
}: {
  attachment: ChatAttachmentDto;
  mine: boolean;
  onOpen: (item: MediaViewerItem) => void;
}) {
  const openItem = (): MediaViewerItem => ({
    kind: attachment.is_image ? "image" : attachment.is_video ? "video" : "file",
    url: attachment.url,
    downloadUrl: attachment.download_url,
    fileName: attachment.file_name,
    mimeType: attachment.file_type,
    durationSeconds: attachment.duration_seconds,
  });

  if (attachment.is_image) {
    const previewUrl = attachment.thumbnail_url ?? attachment.url;
    return (
      <button
        type="button"
        onClick={() => onOpen(openItem())}
        className="mt-2 block max-w-[min(100%,280px)] overflow-hidden rounded-lg border border-black/10 dark:border-white/10 text-left"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={attachment.file_name}
          loading="lazy"
          className="w-full h-auto object-cover"
        />
      </button>
    );
  }

  if (attachment.is_video) {
    const poster = attachment.thumbnail_url ?? undefined;
    const duration = formatMediaDuration(attachment.duration_seconds);
    return (
      <button
        type="button"
        onClick={() => onOpen(openItem())}
        className="relative mt-2 block max-w-[min(100%,280px)] overflow-hidden rounded-lg border border-black/10 dark:border-white/10 text-left"
      >
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt={attachment.file_name} loading="lazy" className="w-full h-auto object-cover" />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-black/10">Video</div>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/25">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white">
            <Play size={20} className="ml-0.5" />
          </span>
        </span>
        {duration && (
          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">
            {duration}
          </span>
        )}
      </button>
    );
  }

  if (attachment.file_type === "application/pdf") {
    return (
      <button
        type="button"
        onClick={() => onOpen(openItem())}
        className={`mt-2 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left ${
          mine
            ? "border-white/20 bg-white/10 hover:bg-white/15"
            : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
        }`}
      >
        <FileText size={16} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{attachment.file_name}</span>
          <span className={`block text-xs ${mine ? "text-white/70" : "muted"}`}>
            PDF · {formatFileSize(attachment.file_size)}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div
      className={`mt-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
        mine
          ? "border-white/20 bg-white/10"
          : "border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]"
      }`}
    >
      <FileText size={16} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{attachment.file_name}</span>
        <span className={`block text-xs ${mine ? "text-white/70" : "muted"}`}>
          {formatFileSize(attachment.file_size)}
        </span>
      </span>
      <a
        href={attachment.download_url}
        download={attachment.file_name}
        className={`inline-flex shrink-0 items-center justify-center rounded-md p-2 ${
          mine ? "hover:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/5"
        }`}
        aria-label={`Download ${attachment.file_name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <Download size={16} />
      </a>
    </div>
  );
}
