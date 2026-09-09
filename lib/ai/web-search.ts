/**
 * Google Search grounding via the Gemini REST API.
 * Used for WEB and COMBINED (phase 2) source routes only.
 */

import { geminiModelCandidates, requireGeminiApiKey } from "./gemini-config";
import { withGeminiRetryAndModelFallback } from "./gemini-retry";
import { toGeminiAssistantError, sanitizeAiText } from "./assistant-errors";

const WEB_SYSTEM_INSTRUCTION = `You are a veterinary and dairy husbandry reference assistant.
Use Google Search to find current, authoritative agricultural and veterinary guidance.
Prioritize peer-reviewed, government extension, and major veterinary sources.
Never invent citations. If uncertain, say so.
For dosage or treatment questions, include a clear disclaimer to consult a licensed veterinarian.
Do not present general knowledge as if it were data from a specific farm's records.`;

export interface WebGroundingResult {
  answer: string;
  /** Present when the model returned search grounding metadata. */
  grounded: boolean;
}

export async function runWebGrounding(params: {
  query: string;
  /** Serialized farm/tool context for COMBINED answers. */
  farmContext?: string;
}): Promise<WebGroundingResult> {
  const apiKey = requireGeminiApiKey();
  const userText = params.farmContext
    ? `${params.query}

--- TerraDairy farm data (facts — do not replace with web guesses) ---
${params.farmContext}
--- End farm data ---

Using the farm data above (if relevant) AND current external veterinary/dairy guidance from web search, answer the user's question. Clearly distinguish farm record facts from external guidance.`
    : params.query;

  try {
    return await withGeminiRetryAndModelFallback("web_grounding", (model) =>
      callWebGrounding(apiKey, model, userText),
    );
  } catch (error) {
    throw toGeminiAssistantError(error);
  }
}

async function callWebGrounding(
  apiKey: string,
  model: string,
  userText: string,
): Promise<WebGroundingResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    systemInstruction: { parts: [{ text: WEB_SYSTEM_INSTRUCTION }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.3 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = sanitizeAiText(await res.text());
    throw new Error(`Web grounding failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      groundingMetadata?: unknown;
    }>;
  };

  const candidate = json.candidates?.[0];
  const text =
    candidate?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";

  if (!text) {
    throw new Error("Web grounding returned an empty response.");
  }

  return {
    answer: text,
    grounded: Boolean(candidate?.groundingMetadata),
  };
}

/** Summarize tool results from the DB phase for the web grounding prompt. */
export function summarizeFarmContext(
  messages: Array<{ role: string; name?: string; content: string }>,
): string {
  const toolLines = messages
    .filter((m) => m.role === "tool" && m.content)
    .map((m) => {
      const label = m.name ?? "tool";
      const snippet = m.content.length > 3000 ? `${m.content.slice(0, 3000)}…` : m.content;
      return `[${label}]: ${snippet}`;
    });

  if (toolLines.length === 0) return "";
  return toolLines.join("\n\n");
}
