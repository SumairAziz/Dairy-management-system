import { execFile } from "child_process";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { promisify } from "util";
import sharp from "sharp";
import { ValidationError } from "@/lib/errors";
import { CHAT_UPLOAD_DIR, sanitizeFileName } from "./storage";

const execFileAsync = promisify(execFile);

export const IMAGE_MAX_DIMENSION = 1920;
export const MAX_RAW_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_RAW_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_RAW_DOCUMENT_BYTES = 25 * 1024 * 1024;

export type ProcessedMedia = {
  storageKey: string;
  thumbnailStorageKey: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  originalFileSize: number;
  mediaType: "image" | "video" | "file";
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
};

function getFfmpegPath(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require("ffmpeg-static") as string | null;
    return ffmpegStatic ?? null;
  } catch {
    return null;
  }
}

function getFfprobePath(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffprobeStatic = require("ffprobe-static") as { path: string };
    return ffprobeStatic?.path ?? null;
  } catch {
    return null;
  }
}

async function safeUnlink(filePath: string) {
  try {
    await unlink(filePath);
  } catch {
    // Ignore missing temp files.
  }
}

async function probeVideoDuration(inputPath: string): Promise<number | null> {
  const ffprobe = getFfprobePath();
  if (!ffprobe) return null;
  try {
    const { stdout } = await execFileAsync(ffprobe, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ]);
    const value = Number.parseFloat(stdout.trim());
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

async function compressVideo(inputPath: string, outputPath: string): Promise<void> {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) {
    throw new ValidationError("Video compression is unavailable on this server (ffmpeg not installed).");
  }

  await execFileAsync(ffmpeg, [
    "-y",
    "-i",
    inputPath,
    "-vf",
    "scale='min(1280,iw)':-2",
    "-c:v",
    "libx264",
    "-crf",
    "28",
    "-preset",
    "fast",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

async function generateVideoThumbnail(inputPath: string, outputPath: string): Promise<void> {
  const ffmpeg = getFfmpegPath();
  if (!ffmpeg) {
    throw new ValidationError("Video thumbnail generation failed (ffmpeg not installed).");
  }

  await execFileAsync(ffmpeg, [
    "-y",
    "-ss",
    "00:00:01",
    "-i",
    inputPath,
    "-vframes",
    "1",
    "-vf",
    "scale='min(640,iw)':-2",
    outputPath,
  ]);
}

async function processImage(
  conversationId: number,
  file: File,
  buffer: Buffer,
): Promise<ProcessedMedia> {
  const safeName = sanitizeFileName(file.name || "image.jpg");
  const baseName = safeName.replace(/\.[^.]+$/, "") || "image";
  const storageKey = `${conversationId}/${randomUUID()}-${baseName}.webp`;
  const thumbKey = `${conversationId}/${randomUUID()}-${baseName}-thumb.webp`;
  const absolutePath = path.join(CHAT_UPLOAD_DIR, storageKey);
  const thumbPath = path.join(CHAT_UPLOAD_DIR, thumbKey);

  await mkdir(path.dirname(absolutePath), { recursive: true });

  const image = sharp(buffer, { failOn: "none" }).rotate();
  const metadata = await image.metadata();
  const width = metadata.width ?? null;
  const height = metadata.height ?? null;

  const resized = image.resize({
    width: IMAGE_MAX_DIMENSION,
    height: IMAGE_MAX_DIMENSION,
    fit: "inside",
    withoutEnlargement: true,
  });

  const compressed = await resized.webp({ quality: 82, effort: 4 }).toBuffer();
  await writeFile(absolutePath, compressed);

  const thumbWidth = Math.min(640, metadata.width ?? 640);
  const thumbBuffer = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: thumbWidth, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 70, effort: 3 })
    .toBuffer();
  await writeFile(thumbPath, thumbBuffer);

  return {
    storageKey,
    thumbnailStorageKey: thumbKey,
    fileName: safeName,
    fileType: "image/webp",
    fileSize: compressed.length,
    originalFileSize: file.size,
    mediaType: "image",
    width,
    height,
    durationSeconds: null,
  };
}

async function processVideo(conversationId: number, file: File, buffer: Buffer): Promise<ProcessedMedia> {
  const safeName = sanitizeFileName(file.name || "video.mp4");
  const baseName = safeName.replace(/\.[^.]+$/, "") || "video";
  const tempInput = path.join(CHAT_UPLOAD_DIR, `${conversationId}/tmp-${randomUUID()}-input`);
  const tempOutput = path.join(CHAT_UPLOAD_DIR, `${conversationId}/tmp-${randomUUID()}-output.mp4`);
  const tempThumb = path.join(CHAT_UPLOAD_DIR, `${conversationId}/tmp-${randomUUID()}-thumb.jpg`);
  const storageKey = `${conversationId}/${randomUUID()}-${baseName}.mp4`;
  const thumbKey = `${conversationId}/${randomUUID()}-${baseName}-thumb.jpg`;
  const absolutePath = path.join(CHAT_UPLOAD_DIR, storageKey);
  const thumbPath = path.join(CHAT_UPLOAD_DIR, thumbKey);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(tempInput, buffer);

  try {
    await compressVideo(tempInput, tempOutput);
    await generateVideoThumbnail(tempOutput, tempThumb);

    const [compressed, thumbBuffer, durationSeconds] = await Promise.all([
      readFile(tempOutput),
      readFile(tempThumb),
      probeVideoDuration(tempOutput),
    ]);

    await writeFile(absolutePath, compressed);
    await writeFile(thumbPath, thumbBuffer);

    let width: number | null = null;
    let height: number | null = null;
    try {
      const meta = await sharp(thumbBuffer).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
    } catch {
      // Thumbnail metadata is optional.
    }

    return {
      storageKey,
      thumbnailStorageKey: thumbKey,
      fileName: safeName,
      fileType: "video/mp4",
      fileSize: compressed.length,
      originalFileSize: file.size,
      mediaType: "video",
      width,
      height,
      durationSeconds,
    };
  } finally {
    await Promise.all([safeUnlink(tempInput), safeUnlink(tempOutput), safeUnlink(tempThumb)]);
  }
}

async function processDocument(
  conversationId: number,
  file: File,
  buffer: Buffer,
  mimeType: string,
): Promise<ProcessedMedia> {
  const ext = path.extname(file.name || "") || "";
  const safeName = sanitizeFileName(file.name || `file${ext}`);
  const storageKey = `${conversationId}/${randomUUID()}-${safeName}`;
  const absolutePath = path.join(CHAT_UPLOAD_DIR, storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  return {
    storageKey,
    thumbnailStorageKey: null,
    fileName: safeName,
    fileType: mimeType,
    fileSize: buffer.length,
    originalFileSize: file.size,
    mediaType: "file",
    width: null,
    height: null,
    durationSeconds: null,
  };
}

export function detectMediaKind(mimeType: string): "image" | "video" | "file" | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (
    [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
    ].includes(mimeType)
  ) {
    return "file";
  }
  return null;
}

export async function processChatMedia(conversationId: number, file: File): Promise<ProcessedMedia> {
  const kind = detectMediaKind(file.type);
  if (!kind) {
    throw new ValidationError("Unsupported file type.");
  }

  if (file.size <= 0) {
    throw new ValidationError("File is empty.");
  }

  if (kind === "image" && file.size > MAX_RAW_IMAGE_BYTES) {
    throw new ValidationError("Image must be 25MB or smaller.");
  }
  if (kind === "video" && file.size > MAX_RAW_VIDEO_BYTES) {
    throw new ValidationError("Video must be 100MB or smaller.");
  }
  if (kind === "file" && file.size > MAX_RAW_DOCUMENT_BYTES) {
    throw new ValidationError("File must be 25MB or smaller.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (kind === "image") return await processImage(conversationId, file, buffer);
    if (kind === "video") return await processVideo(conversationId, file, buffer);
    return await processDocument(conversationId, file, buffer, file.type);
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(
      error instanceof Error ? error.message : "Failed to process media. Please try another file.",
    );
  }
}

export async function deleteStoredMedia(storageKey: string, thumbnailStorageKey?: string | null) {
  await safeUnlink(path.join(CHAT_UPLOAD_DIR, storageKey));
  if (thumbnailStorageKey) {
    await safeUnlink(path.join(CHAT_UPLOAD_DIR, thumbnailStorageKey));
  }
}
