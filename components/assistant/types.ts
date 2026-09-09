import type { AiAssistantErrorPayload } from "@/lib/ai/assistant-errors";

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  isError?: boolean;
  errorInfo?: AiAssistantErrorPayload;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessageData[];
  updatedAt: number;
}
