import type { AiAssistantErrorPayload } from "@/lib/ai/assistant-errors";

export type { AiAssistantErrorPayload };

export function formatProviderLabel(provider?: string): string | undefined {
  if (!provider) return undefined;
  if (provider === "gemini") return "Gemini";
  if (provider === "openai") return "OpenAI";
  if (provider === "database") return "Database";
  return provider;
}

export function formatAssistantErrorSummary(error: AiAssistantErrorPayload): string {
  return error.message;
}

export function formatAssistantErrorDetails(error: AiAssistantErrorPayload): string {
  const lines: string[] = ["**AI Assistant Error**", "", error.message, ""];

  lines.push(`**Error code:** ${error.code}`);
  if (error.provider) lines.push(`**Provider:** ${formatProviderLabel(error.provider)}`);
  if (error.model) lines.push(`**Model:** ${error.model}`);
  if (error.tool) lines.push(`**Tool:** ${error.tool}`);
  if (error.details) lines.push(`**Details:** ${error.details}`);
  if (error.httpStatus !== undefined) {
    lines.push(
      `**HTTP status:** ${error.httpStatus}${error.httpStatusText ? ` — ${error.httpStatusText}` : ""}`,
    );
  }
  if (error.originalError) {
    lines.push("", "**Original error:**", error.originalError);
  }

  return lines.join("\n");
}

export function formatAssistantErrorBanner(error: AiAssistantErrorPayload): string {
  const parts = [error.message, `Error code: ${error.code}`];
  if (error.provider) parts.push(`Provider: ${formatProviderLabel(error.provider)}`);
  if (error.model) parts.push(`Model: ${error.model}`);
  if (error.tool) parts.push(`Tool: ${error.tool}`);
  if (error.details) parts.push(`Details: ${error.details}`);
  if (error.httpStatus !== undefined) {
    parts.push(
      `HTTP ${error.httpStatus}${error.httpStatusText ? ` — ${error.httpStatusText}` : ""}`,
    );
  }
  return parts.join(" · ");
}
