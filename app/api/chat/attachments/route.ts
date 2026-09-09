import { NextRequest } from "next/server";
import { handleApiError, ValidationError } from "@/lib/errors";
import { createdResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { removeChatAttachmentFiles, saveChatAttachment } from "@/lib/chat/storage";
import { createPendingAttachment, mapAttachmentDto } from "@/services/chat.service";

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("messages", "create");
    const formData = await req.formData();
    const conversationId = Number(formData.get("conversation_id"));
    const file = formData.get("file");

    if (!conversationId || !Number.isFinite(conversationId)) {
      throw new ValidationError("Invalid conversation_id.");
    }
    if (!(file instanceof File)) {
      throw new ValidationError("File is required.");
    }

    let processed;
    try {
      processed = await saveChatAttachment(conversationId, file);
    } catch (error) {
      throw error;
    }

    try {
      const attachment = await createPendingAttachment(conversationId, user.id, {
        storageKey: processed.storageKey,
        thumbnailStorageKey: processed.thumbnailStorageKey,
        fileName: processed.fileName,
        fileType: processed.fileType,
        fileSize: processed.fileSize,
        originalFileSize: processed.originalFileSize,
        mediaType: processed.mediaType,
        width: processed.width,
        height: processed.height,
        durationSeconds: processed.durationSeconds,
      });

      return createdResponse(mapAttachmentDto(attachment));
    } catch (error) {
      await removeChatAttachmentFiles(processed.storageKey, processed.thumbnailStorageKey);
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
