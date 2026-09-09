import type { JsonSchema } from "../types";

/** Tiny hand-rolled JSON-Schema builder — keeps tool definitions terse and readable without pulling in a zod-to-json-schema dependency. */
export function objectSchema(
  properties: Record<string, unknown>,
  required: string[] = [],
): JsonSchema {
  return { type: "object", properties, required, additionalProperties: false };
}

export const str = (description: string, enumValues?: readonly string[]) =>
  enumValues ? { type: "string", description, enum: [...enumValues] } : { type: "string", description };

export const num = (description: string) => ({ type: "number", description });

export const int = (description: string) => ({ type: "integer", description });

export const bool = (description: string) => ({ type: "boolean", description });

export const arr = (items: unknown, description: string) => ({
  type: "array",
  items,
  description,
});
