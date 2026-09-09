"use client";

import { useMemo, useState } from "react";
import {
  ChevronRight,
  Copy,
  Download,
  FileText,
  Loader2,
  Share2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useExportToast } from "@/components/export/ExportToastProvider";
import { copyTextToClipboard } from "@/lib/assistant/clipboard";
import {
  downloadTextFile,
  formatChatAsMarkdown,
  formatChatAsPlainText,
  getChatExportMeta,
  isWebShareSupported,
  sanitizeChatFilename,
  shareChatConversation,
} from "@/lib/assistant/chat-export";
import { generateChatPdf, saveChatAsPdf } from "@/lib/assistant/chat-pdf";
import type { Conversation } from "./types";

/** Opaque modal surface — uses legacy RGB tokens shared with the rest of TerraDairy. */
const SHARE_DIALOG_SURFACE = "bg-[rgb(var(--surface))] text-[rgb(var(--text))]";
const SHARE_DIALOG_MUTED = "text-[rgb(var(--muted-color))]";
const SHARE_DIALOG_BORDER = "border-black/10 dark:border-white/12";
const SHARE_DIALOG_HOVER = "hover:bg-[rgb(var(--surface-2))] active:bg-[rgb(var(--surface-2))]";

interface ShareChatDialogProps {
  conversation: Conversation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExportOption {
  key: string;
  title: string;
  description: string;
  icon: typeof FileText;
  onClick: () => void | Promise<void>;
}

function ShareExportOption({
  option,
  busy,
  disabled,
}: {
  option: ExportOption;
  busy: boolean;
  disabled: boolean;
}) {
  const Icon = option.icon;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={option.onClick}
      className={cn(
        "group w-full min-w-0 flex items-center gap-3 px-5 py-3.5 text-left transition-colors",
        SHARE_DIALOG_HOVER,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
      aria-label={option.title}
    >
      <span
        className={cn(
          "shrink-0 flex h-9 w-9 items-center justify-center rounded-lg",
          "bg-[rgb(var(--surface-2))] text-[rgb(var(--text))]",
          "border",
          SHARE_DIALOG_BORDER,
        )}
      >
        {busy ? <Loader2 size={17} className="animate-spin" /> : <Icon size={17} strokeWidth={2} />}
      </span>
      <span className="min-w-0 flex-1 overflow-hidden">
        <span className="block text-sm font-semibold leading-snug text-[rgb(var(--text))]">
          {option.title}
        </span>
        <span className={cn("block text-xs leading-snug mt-0.5", SHARE_DIALOG_MUTED)}>{option.description}</span>
      </span>
      {!busy && (
        <ChevronRight
          size={16}
          className={cn("shrink-0", SHARE_DIALOG_MUTED)}
          strokeWidth={2}
          aria-hidden
        />
      )}
    </button>
  );
}

export function ShareChatDialog({ conversation, open, onOpenChange }: ShareChatDialogProps) {
  const { showToast } = useExportToast();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const webShareSupported = isWebShareSupported();

  const meta = conversation ? getChatExportMeta(conversation) : null;
  const hasMessages = (meta?.messageCount ?? 0) > 0;

  async function withBusy(key: string, action: () => Promise<void>): Promise<void> {
    setBusyKey(key);
    try {
      await action();
    } catch {
      if (key === "pdf") showToast("Unable to create PDF. Please try again.", "error");
      else showToast("Export failed. Please try again.", "error");
    } finally {
      setBusyKey(null);
    }
  }

  const exportOptions = useMemo<ExportOption[]>(() => {
    if (!conversation || !hasMessages) return [];

    const options: ExportOption[] = [
      {
        key: "pdf",
        title: "Save as PDF",
        description: "Professional formatted document",
        icon: FileText,
        onClick: async () => {
          await withBusy("pdf", async () => {
            const filename = sanitizeChatFilename(meta!.title, meta!.conversationDate, "pdf");
            await saveChatAsPdf(conversation, filename);
            showToast("PDF downloaded.", "success");
          });
        },
      },
    ];

    if (webShareSupported) {
      options.push({
        key: "share",
        title: "Share conversation",
        description: "Share through available apps",
        icon: Share2,
        onClick: async () => {
          await withBusy("share", async () => {
            let pdfBlob: Blob | undefined;
            try {
              pdfBlob = await generateChatPdf(conversation);
            } catch {
              pdfBlob = undefined;
            }
            const result = await shareChatConversation(conversation, pdfBlob);
            if (result === "shared") showToast("Conversation shared.", "success");
          });
        },
      });
    }

    options.push(
      {
        key: "copy-md",
        title: "Copy as Markdown",
        description: "Copy formatted conversation",
        icon: Copy,
        onClick: async () => {
          await withBusy("copy-md", async () => {
            const text = formatChatAsMarkdown(conversation);
            const result = await copyTextToClipboard(text);
            if (!result.ok) {
              showToast(result.error, "error");
              return;
            }
            showToast("Markdown copied to clipboard.", "success");
          });
        },
      },
      {
        key: "copy-txt",
        title: "Copy as Plain Text",
        description: "Copy readable conversation",
        icon: Copy,
        onClick: async () => {
          await withBusy("copy-txt", async () => {
            const text = formatChatAsPlainText(conversation);
            const result = await copyTextToClipboard(text);
            if (!result.ok) {
              showToast(result.error, "error");
              return;
            }
            showToast("Plain text copied to clipboard.", "success");
          });
        },
      },
      {
        key: "download-md",
        title: "Download Markdown",
        description: "Save as .md file",
        icon: Download,
        onClick: async () => {
          await withBusy("download-md", async () => {
            const text = formatChatAsMarkdown(conversation);
            const filename = sanitizeChatFilename(meta!.title, meta!.conversationDate, "md");
            downloadTextFile(filename, text, "text/markdown;charset=utf-8");
            showToast("Markdown file downloaded.", "success");
          });
        },
      },
      {
        key: "download-txt",
        title: "Download Plain Text",
        description: "Save as .txt file",
        icon: Download,
        onClick: async () => {
          await withBusy("download-txt", async () => {
            const text = formatChatAsPlainText(conversation);
            const filename = sanitizeChatFilename(meta!.title, meta!.conversationDate, "txt");
            downloadTextFile(filename, text, "text/plain;charset=utf-8");
            showToast("Plain text file downloaded.", "success");
          });
        },
      },
    );

    return options;
  }, [conversation, hasMessages, meta, showToast, webShareSupported]);

  return (
    <Dialog open={open && !!conversation} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/50 dark:bg-black/70 backdrop-blur-none"
        className={cn(
          SHARE_DIALOG_SURFACE,
          "w-[min(500px,calc(100vw-32px))] max-w-[500px]",
          "p-0 gap-0 overflow-hidden",
          "max-h-[min(90dvh,calc(100dvh-2rem))] flex flex-col",
          "border shadow-xl ring-0",
          SHARE_DIALOG_BORDER,
          "!bg-[rgb(var(--surface))] !text-[rgb(var(--text))]",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4",
            SHARE_DIALOG_BORDER,
            SHARE_DIALOG_SURFACE,
          )}
        >
          <DialogHeader className="min-w-0 flex-1 space-y-1.5 text-left">
            <DialogTitle className="text-base font-semibold leading-tight text-[rgb(var(--text))]">
              Share conversation
            </DialogTitle>
            <DialogDescription className={cn("text-sm leading-relaxed", SHARE_DIALOG_MUTED)}>
              Export this TerraDairy AI chat as a professional document or share it with another app.
            </DialogDescription>
          </DialogHeader>

          <DialogClose asChild>
            <button
              type="button"
              aria-label="Close"
              title="Close"
              className={cn(
                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                SHARE_DIALOG_BORDER,
                "bg-[rgb(var(--surface-2))] text-[rgb(var(--text))]",
                SHARE_DIALOG_HOVER,
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--surface))]",
              )}
            >
              <X size={16} strokeWidth={2} />
            </button>
          </DialogClose>
        </div>

        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain",
            SHARE_DIALOG_SURFACE,
          )}
        >
          {!hasMessages ? (
            <p className={cn("px-5 py-6 text-sm", SHARE_DIALOG_MUTED)}>
              Start a conversation before sharing or exporting.
            </p>
          ) : (
            <div className={cn("divide-y", SHARE_DIALOG_BORDER)} role="list">
              {exportOptions.map((option) => (
                <ShareExportOption
                  key={option.key}
                  option={option}
                  busy={busyKey === option.key}
                  disabled={busyKey !== null && busyKey !== option.key}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ShareChatButton({
  disabled,
  onOpen,
}: {
  disabled?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onOpen}
      aria-label="Share conversation"
      title="Share"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium",
        SHARE_DIALOG_BORDER,
        SHARE_DIALOG_SURFACE,
        SHARE_DIALOG_HOVER,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      <Share2 size={15} />
      Share
    </button>
  );
}
