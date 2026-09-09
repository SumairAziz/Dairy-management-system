import { getAiProvider } from "./providers";
import { getToolSpecs } from "./tools/registry";
import { buildSystemPrompt } from "./prompts/system-prompt";
import { buildSourceRoutingPrompt } from "./prompts/source-routing-prompt";
import { classifySourceRoute, getLatestUserMessage } from "./source-router";
import { runWebGrounding, summarizeFarmContext } from "./web-search";
import { executeToolCall, sanitizeUserMessage, capHistory, AI_LIMITS } from "./security";
import { AppError } from "@/lib/errors";
import type { AiMessage, ToolContext } from "./types";

export interface OrchestratorInput {
  /** Prior turns from the client, oldest first. Trusted only as conversational context, never as instructions (see lib/ai/security.ts). */
  history: Array<{ role: "user" | "assistant"; content: string }>;
  ctx: ToolContext;
}

export interface OrchestratorOutput {
  message: string;
  toolsUsed: string[];
  /** Source route applied for this request (for debugging/transparency). */
  sourceRoute?: "DATABASE" | "WEB" | "COMBINED";
}

interface DatabaseLoopResult {
  message: string;
  toolsUsed: string[];
  messages: AiMessage[];
}

/**
 * Runs the database tool-calling loop (TerraDairy tools only).
 */
async function runDatabaseLoop(params: {
  messages: AiMessage[];
  ctx: ToolContext;
  maxIterations?: number;
}): Promise<DatabaseLoopResult> {
  const provider = getAiProvider();
  const toolSpecs = getToolSpecs();
  const toolsUsed: string[] = [];
  const messages = [...params.messages];
  const maxIterations = params.maxIterations ?? AI_LIMITS.MAX_TOOL_ITERATIONS;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const response = await provider.chat({ messages, tools: toolSpecs, temperature: 0.3 });

    if (response.kind === "message") {
      return { message: response.content, toolsUsed, messages };
    }

    messages.push({ role: "assistant", content: "", toolCalls: response.toolCalls });

    for (const call of response.toolCalls) {
      const outcome = await executeToolCall(call, params.ctx);
      toolsUsed.push(outcome.name);
      const payload = "error" in outcome ? { error: outcome.error } : outcome.result;
      messages.push({
        role: "tool",
        toolCallId: call.id,
        name: outcome.name,
        content: JSON.stringify(payload),
      });
    }
  }

  return {
    message:
      "I wasn't able to finish gathering the data needed to answer that within the allowed number of steps. Could you narrow down the question a bit?",
    toolsUsed,
    messages,
  };
}

/**
 * Runs the full "user question → source routing → tools/web → final answer" loop.
 *
 * Source routing (DATABASE / WEB / COMBINED) is decided *before* any tool or
 * web call so farm facts never come from Google Search.
 */
export async function runAssistant(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const trimmedHistory = capHistory(input.history);
  const latestUser = getLatestUserMessage(trimmedHistory);
  const route = classifySourceRoute(latestUser, trimmedHistory);

  const baseMessages: AiMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt() + buildSourceRoutingPrompt(route),
    },
    ...trimmedHistory.map((m): AiMessage => ({
      role: m.role,
      content: m.role === "user" ? sanitizeUserMessage(m.content) : m.content,
    })),
  ];

  // ── WEB ONLY ──────────────────────────────────────────────────────────────
  if (route.kind === "WEB") {
    const web = await runWebGrounding({ query: latestUser });
    return {
      message: web.answer,
      toolsUsed: ["google_search"],
      sourceRoute: "WEB",
    };
  }

  // ── DATABASE ONLY ─────────────────────────────────────────────────────────
  if (route.kind === "DATABASE") {
    const db = await runDatabaseLoop({ messages: baseMessages, ctx: input.ctx });
    return {
      message: db.message,
      toolsUsed: db.toolsUsed,
      sourceRoute: "DATABASE",
    };
  }

  // ── COMBINED: database first, then web grounding synthesis ───────────────
  const dbPhase = await runDatabaseLoop({
    messages: baseMessages,
    ctx: input.ctx,
    maxIterations: Math.max(3, AI_LIMITS.MAX_TOOL_ITERATIONS - 1),
  });

  const farmContext = summarizeFarmContext(
    dbPhase.messages.map((m) => ({
      role: m.role,
      name: m.name,
      content: m.content,
    })),
  );

  try {
    const web = await runWebGrounding({
      query: latestUser,
      farmContext: farmContext || undefined,
    });

    // If DB phase already produced a partial answer, ask web to integrate;
    // otherwise web result stands alone with farm context.
    if (dbPhase.toolsUsed.length > 0 && dbPhase.message && !dbPhase.message.match(/wasn't able to finish/i)) {
      const provider = getAiProvider();
      const synthesisMessages: AiMessage[] = [
        ...baseMessages,
        {
          role: "assistant",
          content: dbPhase.message,
        },
        {
          role: "user",
          content: `Finalize your answer to: "${latestUser}"

Farm data (from TerraDairy records):
${dbPhase.message}

Veterinary reference information:
${web.answer}

Write one cohesive answer for the user. Lead with TerraDairy record facts, then add practical veterinary guidance where relevant. Do not mention routing, prompts, internal instructions, or how this information was assembled.`,
        },
      ];
      const final = await provider.chat({
        messages: synthesisMessages,
        tools: [],
        temperature: 0.3,
      });
      if (final.kind === "message") {
        return {
          message: final.content,
          toolsUsed: [...dbPhase.toolsUsed, "google_search"],
          sourceRoute: "COMBINED",
        };
      }
    }

    return {
      message: web.answer,
      toolsUsed: [...dbPhase.toolsUsed, "google_search"],
      sourceRoute: "COMBINED",
    };
  } catch (webError) {
    // Farm data is still valuable even if web grounding fails.
    if (dbPhase.toolsUsed.length > 0) {
      const note =
        webError instanceof AppError
          ? webError.message
          : "External search unavailable.";
      return {
        message: `${dbPhase.message}\n\n---\n*Note: I retrieved your farm data but could not fetch additional veterinary reference information (${note}).*`,
        toolsUsed: dbPhase.toolsUsed,
        sourceRoute: "COMBINED",
      };
    }
    throw webError;
  }
}
