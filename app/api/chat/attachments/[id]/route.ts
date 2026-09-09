import { handleApiError } from "@/lib/errors";
import { requirePermission, resolveId } from "@/lib/api-auth";
import { readChatAttachment } from "@/lib/chat/storage";
import { getAttachmentForUser } from "@/services/chat.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = await requirePermission("messages", "read");
    const attachmentId = await resolveId(ctx.params, "id");
    const attachment = await getAttachmentForUser(attachmentId, user.id);

    const url = new URL(req.url);
    const download = url.searchParams.get("download") === "1";
    const variant = url.searchParams.get("variant");

    const storageKey =
      variant === "thumbnail" && attachment.thumbnail_storage_key
        ? attachment.thumbnail_storage_key
        : attachment.storage_key;

    const buffer = await readChatAttachment(storageKey);
    const mimeType =
      variant === "thumbnail" && attachment.thumbnail_storage_key
        ? storageKey.endsWith(".webp")
          ? "image/webp"
          : "image/jpeg"
        : attachment.file_type;

    const disposition = download ? "attachment" : "inline";
    const fileName = attachment.file_name.replace(/"/g, "");

    return new Response(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `${disposition}; filename="${fileName}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
