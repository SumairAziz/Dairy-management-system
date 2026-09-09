import { readFile } from "fs/promises";
import path from "path";
import { ValidationError } from "@/lib/errors";
import { deleteStoredMedia, detectMediaKind, processChatMedia, type ProcessedMedia } from "./media-processor";

export const CHAT_UPLOAD_DIR = path.join(process.cwd(), "uploads", "chat");

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

export function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export function validateAttachment(file: File) {
  if (!ALLOWED_MIME_TYPES.has(file.type) || !detectMediaKind(file.type)) {
    throw new ValidationError("Unsupported file type.");
  }
}

export async function saveChatAttachment(
  conversationId: number,
  file: File,
): Promise<ProcessedMedia> {
  validateAttachment(file);
  return processChatMedia(conversationId, file);
}

export async function readChatAttachment(storageKey: string) {
  const absolutePath = resolveStoragePath(storageKey);
  return readFile(absolutePath);
}

export function resolveStoragePath(storageKey: string) {
  const absolutePath = path.join(CHAT_UPLOAD_DIR, storageKey);
  const normalizedRoot = path.normalize(CHAT_UPLOAD_DIR);
  const normalizedTarget = path.normalize(absolutePath);
  if (!normalizedTarget.startsWith(normalizedRoot)) {
    throw new ValidationError("Invalid attachment path.");
  }
  return absolutePath;
}

export function isImageMimeType(mime: string) {
  return mime.startsWith("image/");
}

export function isVideoMimeType(mime: string) {
  return mime.startsWith("video/");
}

export async function removeChatAttachmentFiles(
  storageKey: string,
  thumbnailStorageKey?: string | null,
) {
  await deleteStoredMedia(storageKey, thumbnailStorageKey);
}
