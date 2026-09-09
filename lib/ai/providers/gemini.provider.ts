import {
  GoogleGenerativeAI,
  SchemaType,
  type Content,
  type FunctionDeclaration,
  type FunctionDeclarationSchema,
  type Part,
} from "@google/generative-ai";
import type { AiChatRequest, AiChatResponse, AiMessage, AiProvider, AiToolSpec, JsonSchema } from "../types";
import { requireGeminiApiKey } from "../gemini-config";
import { toGeminiAssistantError } from "../assistant-errors";
import { withGeminiRetryAndModelFallback } from "../gemini-retry";

function toGeminiSchema(schema: JsonSchema): FunctionDeclarationSchema {
  const properties: FunctionDeclarationSchema["properties"] = {};
  for (const [key, value] of Object.entries(schema.properties)) {
    properties[key] = value as FunctionDeclarationSchema["properties"][string];
  }
  return {
    type: SchemaType.OBJECT,
    properties,
    required: schema.required,
  };
}

function toFunctionDeclarations(tools: AiToolSpec[]): FunctionDeclaration[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: toGeminiSchema(tool.parameters),
  }));
}

function toGeminiFunctionResponse(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    return { items: value };
  }
  if (value !== null && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return { result: value };
}

function toGeminiContents(messages: AiMessage[]): { systemInstruction?: string; contents: Content[] } {
  let systemInstruction: string | undefined;
  const contents: Content[] = [];

  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (message.role === "system") {
      systemInstruction = message.content;
      continue;
    }

    if (message.role === "user") {
      contents.push({ role: "user", parts: [{ text: message.content }] });
      continue;
    }

    if (message.role === "assistant") {
      const parts: Part[] = [];
      if (message.content) {
        parts.push({ text: message.content });
      }
      for (const call of message.toolCalls ?? []) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }
        const part: Part = { functionCall: { name: call.name, args } };
        if (call.thoughtSignature) {
          (part as Part & { thoughtSignature?: string }).thoughtSignature = call.thoughtSignature;
        }
        parts.push(part);
      }
      if (parts.length > 0) {
        contents.push({ role: "model", parts });
      }
      continue;
    }

    if (message.role === "tool" && message.name) {
      const toolParts: Part[] = [];
      let cursor = index;
      while (cursor < messages.length && messages[cursor].role === "tool" && messages[cursor].name) {
        const toolMessage = messages[cursor];
        let parsed: unknown;
        try {
          parsed = JSON.parse(toolMessage.content || "{}");
        } catch {
          parsed = { error: "Invalid tool response payload" };
        }
        toolParts.push({
          functionResponse: {
            name: toolMessage.name!,
            response: toGeminiFunctionResponse(parsed),
          },
        });
        cursor++;
      }
      contents.push({ role: "user", parts: toolParts });
      index = cursor - 1;
    }
  }

  return { systemInstruction, contents };
}

async function generateWithModel(
  genAI: GoogleGenerativeAI,
  modelName: string,
  request: AiChatRequest,
  systemInstruction: string | undefined,
  contents: Content[],
): Promise<AiChatResponse> {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    tools: request.tools.length
      ? [{ functionDeclarations: toFunctionDeclarations(request.tools) }]
      : undefined,
  });

  const result = await model.generateContent({
    contents,
    generationConfig: {
      temperature: request.temperature ?? 0.3,
    },
  });

  const response = result.response;
  const rawParts = response.candidates?.[0]?.content?.parts ?? [];
  const functionCallParts = rawParts.filter(
    (part): part is Part & { functionCall: NonNullable<Part["functionCall"]> } =>
      Boolean(part.functionCall),
  );

  if (functionCallParts.length > 0) {
    return {
      kind: "tool_calls",
      toolCalls: functionCallParts.map((part, index) => ({
        id: `gemini-${part.functionCall.name}-${Date.now()}-${index}`,
        name: part.functionCall.name,
        arguments: JSON.stringify(part.functionCall.args ?? {}),
        thoughtSignature: (part as Part & { thoughtSignature?: string }).thoughtSignature,
      })),
    };
  }

  const legacyFunctionCalls = response.functionCalls();
  if (legacyFunctionCalls?.length) {
    return {
      kind: "tool_calls",
      toolCalls: legacyFunctionCalls.map((call, index) => ({
        id: `gemini-${call.name}-${Date.now()}-${index}`,
        name: call.name,
        arguments: JSON.stringify(call.args ?? {}),
      })),
    };
  }

  const text = response.text();
  if (!text) {
    throw new Error("The AI provider returned an empty response.");
  }

  return { kind: "message", content: text };
}

export function createGeminiProvider(): AiProvider {
  let client: GoogleGenerativeAI | null = null;
  let lastWorkingModel: string | null = null;

  function getClient(): GoogleGenerativeAI {
    const apiKey = requireGeminiApiKey();
    if (!client) client = new GoogleGenerativeAI(apiKey);
    return client;
  }

  return {
    id: "gemini",
    async chat(request: AiChatRequest): Promise<AiChatResponse> {
      try {
        const genAI = getClient();
        const { systemInstruction, contents } = toGeminiContents(request.messages);

        return await withGeminiRetryAndModelFallback(
          "chat",
          async (model) => {
            const result = await generateWithModel(
              genAI,
              model,
              request,
              systemInstruction,
              contents,
            );
            lastWorkingModel = model;
            return result;
          },
          { preferredModel: lastWorkingModel },
        );
      } catch (error) {
        throw toGeminiAssistantError(error);
      }
    },
  };
}
