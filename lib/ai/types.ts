// ─── Core AI module types ──────────────────────────────────────────────────
// Everything the rest of the app (API route, chat UI) needs to know about
// the AI Assistant lives here. This file has ZERO dependency on any specific
// LLM vendor SDK — that isolation is what lets `lib/ai/providers/*` swap
// OpenAI for Claude/Gemini later without touching tools, prompts, or the UI.

import type { ZodType } from "zod";

// ── Conversation ─────────────────────────────────────────────────────────────

export type AiRole = "system" | "user" | "assistant" | "tool";

/** A single turn in the conversation, provider-agnostic. */
export interface AiMessage {
  role: AiRole;
  /** Human/assistant text content. Empty string when a message is pure tool-calls. */
  content: string;
  /** Present on assistant messages that requested tool execution. */
  toolCalls?: AiToolCall[];
  /** Present on role:"tool" messages — links the result back to its call. */
  toolCallId?: string;
  /** Present on role:"tool" messages — the tool name that produced this result. */
  name?: string;
}

export interface AiToolCall {
  id: string;
  name: string;
  /** Raw JSON-string arguments as returned by the model (validated before execution). */
  arguments: string;
  /** Required by Gemini 3.x when replaying parallel function calls on later turns. */
  thoughtSignature?: string;
}

// ── Tools ────────────────────────────────────────────────────────────────────

/** JSON-Schema subset accepted by every major function-calling API (OpenAI/Claude/Gemini all converge on this shape). */
export interface JsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolContext {
  userId: number;
  role: string;
}

/**
 * A single backend capability the model may invoke. `schema` is the runtime
 * (zod) validator for the arguments the model supplies — every tool call is
 * re-validated server-side before touching the database, regardless of what
 * the model claims to have sent. `handler` never runs raw SQL; it only calls
 * into `services/*` or scoped, read-only Prisma queries.
 */
export interface AiTool<Args = unknown, Result = unknown> {
  name: string;
  description: string;
  parameters: JsonSchema;
  schema: ZodType<Args>;
  /** Grouping used for UI ("Milk Production", "Reports", ...) and future module toggles. */
  category: string;
  handler: (args: Args, ctx: ToolContext) => Promise<Result>;
}

/** Vendor-agnostic tool spec passed to `AiProvider.chat()`. */
export interface AiToolSpec {
  name: string;
  description: string;
  parameters: JsonSchema;
}

// ── Provider abstraction ─────────────────────────────────────────────────────

export interface AiChatRequest {
  messages: AiMessage[];
  tools: AiToolSpec[];
  temperature?: number;
}

/** Either the model wants to call tools, or it produced a final answer. */
export type AiChatResponse =
  | { kind: "tool_calls"; toolCalls: AiToolCall[] }
  | { kind: "message"; content: string };

/**
 * The single interface every LLM vendor adapter implements. The orchestrator
 * and every tool are written entirely against this interface, so swapping
 * `lib/ai/providers/openai.provider.ts` for an Anthropic/Gemini adapter is a
 * one-line change in `lib/ai/providers/index.ts` — nothing else moves.
 */
export interface AiProvider {
  id: string;
  chat(request: AiChatRequest): Promise<AiChatResponse>;
}

// ── Rich response blocks (tables/charts/reports rendered by the chat UI) ────

export interface TableBlock {
  type: "table";
  title?: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string | number | boolean | null>>;
}

export type ChartType = "line" | "bar" | "pie" | "area" | "stacked-bar";

export interface ChartSeries {
  key: string;
  label?: string;
  color?: string;
}

export interface ChartBlock {
  type: "chart";
  chartType: ChartType;
  title?: string;
  /** Field in each `data` row used for the X axis / pie slice label. */
  xKey: string;
  series: ChartSeries[];
  data: Array<Record<string, string | number>>;
  yLabel?: string;
}

export interface ReportBlock {
  type: "report";
  title: string;
  summary: string;
  tables?: TableBlock[];
  charts?: ChartBlock[];
  insights?: string[];
  recommendations?: string[];
}

export type StructuredBlock = TableBlock | ChartBlock | ReportBlock;

// ── API contract (app/api/assistant/chat) ────────────────────────────────────

export interface AssistantChatRequestBody {
  /** Full running transcript from the client — the assistant is stateless server-side (see ADR in lib/ai/README notes below). */
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface AssistantChatResponseBody {
  message: string;
  /** Names of tools / sources invoked (includes `google_search` when web grounding was used). */
  toolsUsed: string[];
  /** Source route applied for this answer. */
  sourceRoute?: "DATABASE" | "WEB" | "COMBINED";
}
