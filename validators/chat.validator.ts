import { z } from "zod";

export const chatUsersQuerySchema = z.object({
  search: z.string().optional(),
});

export const createConversationSchema = z.object({
  user_id: z.coerce.number().int().positive(),
});

export const sendMessageSchema = z.object({
  body: z.string().max(5000).optional(),
  message_type: z.enum(["text", "image", "video", "file"]).default("text"),
  attachment_ids: z.array(z.coerce.number().int().positive()).optional(),
});

export const olderMessagesQuerySchema = z.object({
  before: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
