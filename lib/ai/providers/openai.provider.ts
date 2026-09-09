import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { AiChatRequest, AiChatResponse, AiMessage, AiProvider, AiToolSpec } from "../types";
import { toOpenAiAssistantError, AiAssistantError } from "../assistant-errors";

/**
 * OpenAI adapter — the ONLY file in the codebase that imports the `openai`
 * package. Everything else (tools, orchestrator, UI, API route) talks to the
 * vendor-neutral `AiProvider` interface, so replacing GPT-5.5 with Claude or
 * Gemini later means writing `lib/ai/providers/anthropic.provider.ts` (or
 * `.gemini.provider.ts`) implementing the same interface and flipping
 * `AI_PROVIDER` in `.env` — no changes anywhere else.
 *
 * Model name is intentionally read from env rather than hardcoded: set
 * `OPENAI_MODEL=gpt-5.5` (or whatever flagship tool-calling model your OpenAI
 * account has access to) without touching code.
 */
function toOpenAiMessages(messages: AiMessage[]): ChatCompletionMessageParam[] {
  return messages.map((m): ChatCompletionMessageParam => {
    if (m.role === "tool") {
      return {
        role: "tool",
        tool_call_id: m.toolCallId ?? "",
        content: m.content,
      };
    }
    if (m.role === "assistant") {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls?.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    return { role: m.role as "system" | "user", content: m.content };
  });
}

function toOpenAiTools(tools: AiToolSpec[]): ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters as unknown as Record<string, unknown>,
    },
  }));
}

export function createOpenAiProvider(): AiProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5.5";

  // Client is created lazily inside chat() rather than at module load so a
  // missing API key only fails when the assistant is actually used, not at
  // server boot / build time.
  let client: OpenAI | null = null;
  function getClient(): OpenAI {
    if (!apiKey) {
      throw new AiAssistantError(
        503,
        "AI_MISSING_KEY",
        "OpenAI API key is not configured.",
        {
          provider: "openai",
          model,
          details: "OPENAI_API_KEY is missing from the environment.",
        },
      );
    }
    if (!client) client = new OpenAI({ apiKey });
    return client;
  }

  return {
    id: "openai",
    async chat(request: AiChatRequest): Promise<AiChatResponse> {
      try {
        const openai = getClient();
        const completion = await openai.chat.completions.create({
          model,
          messages: toOpenAiMessages(request.messages),
          tools: request.tools.length ? toOpenAiTools(request.tools) : undefined,
          tool_choice: request.tools.length ? "auto" : undefined,
          temperature: request.temperature ?? 0.3,
        });

        const choice = completion.choices[0];
        const message = choice?.message;
        if (!message) {
          throw new Error("The AI provider returned an empty response.");
        }

        const functionCalls = (message.tool_calls ?? []).filter(
          (tc): tc is Extract<typeof tc, { type: "function" }> => tc.type === "function",
        );
        if (functionCalls.length > 0) {
          return {
            kind: "tool_calls",
            toolCalls: functionCalls.map((tc) => ({
              id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments,
            })),
          };
        }

        return { kind: "message", content: message.content ?? "" };
      } catch (error) {
        throw toOpenAiAssistantError(error);
      }
    },
  };
}
