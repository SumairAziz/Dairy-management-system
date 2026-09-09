import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/gemini-retry", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/gemini-retry")>("@/lib/ai/gemini-retry");
  return {
    ...actual,
    withGeminiRetryAndModelFallback: vi.fn(
      (_operation: string, execute: (model: string) => Promise<unknown>) =>
        execute("gemini-2.5-flash"),
    ),
  };
});

import { runWebGrounding } from "@/lib/ai/web-search";

describe("lib/ai/web-search", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps google_search in the grounding request body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: "Mastitis is inflammation of the udder." }] },
              groundingMetadata: { webSearchQueries: ["mastitis causes cattle"] },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    process.env.GEMINI_API_KEY = "test-key";
    const result = await runWebGrounding({ query: "What causes mastitis?" });

    expect(result.answer).toContain("Mastitis");
    expect(result.grounded).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.tools).toEqual([{ google_search: {} }]);
    expect(body.contents[0].parts[0].text).toBe("What causes mastitis?");
  });
});
