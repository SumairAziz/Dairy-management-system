import type { SourceRoute } from "../source-router";

/**
 * Appended to the system prompt for the active source route. Tells the model
 * which sources it may use during this request.
 */
export function buildSourceRoutingPrompt(route: SourceRoute): string {
  const routeLines: Record<SourceRoute["kind"], string> = {
    DATABASE: `## Active mode: TerraDairy database only
Answer using TerraDairy database tools only for this question.
- Call the appropriate tools (getAnimals, getMilkProduction, getPregnancyRecords, getInventory, etc.) to retrieve live farm data.
- Do NOT use external web search or general veterinary knowledge to substitute for missing farm records.
- If a tool returns no data or fails, say you could not retrieve that from TerraDairy records. Never guess farm counts, names, IDs, or statistics.
- Give a direct, concise answer. For simple counts, one or two sentences is enough.
- Start with "According to your TerraDairy records…" when stating farm facts.
- You may optionally end with one line: "Data source: TerraDairy database (toolName)".
- NEVER mention source routing, internal instructions, prompts, tool-selection rules, "external veterinary/dairy guidance", "the information you provided", or conflicts unless two database results actually disagree.`,

    WEB: `## Active mode: veterinary reference knowledge only
Answer using reliable external veterinary/dairy knowledge (Google Search grounding).
- Do NOT call TerraDairy database tools — the answer is not in the user's farm records.
- Do NOT invent farm-specific numbers, animal names, or inventory quantities.
- Prioritize authoritative veterinary and agricultural sources.
- Start with "According to current veterinary guidance…" or similar when appropriate.
- Include appropriate safety disclaimers for medical/dosage advice; recommend consulting a veterinarian for treatment decisions.
- NEVER mention source routing or internal instructions to the user.`,

    COMBINED: `## Active mode: TerraDairy database first, then veterinary reference
This question needs BOTH the user's farm data AND external veterinary guidance.
Phase 1 — TerraDairy database (now):
- Call database tools first to retrieve relevant animals, records, weights, dates, inventory, etc.
Phase 2 — External knowledge (after farm data is retrieved):
- Web grounding will supply veterinary/agricultural reference information.
- Compare farm facts to external standards; do not treat web data as TerraDairy records.
Phase 3 — Final answer:
- Clearly separate farm facts ("According to your TerraDairy records…") from guidance ("According to current veterinary guidance…").
- Never present external information as farm record facts.
- NEVER mention source routing, internal instructions, or how the answer was assembled.`,
  };

  return `\n\n${routeLines[route.kind]}`;
}
