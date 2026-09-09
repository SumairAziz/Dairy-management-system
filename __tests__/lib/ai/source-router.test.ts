import { describe, it, expect } from "vitest";
import { classifySourceRoute } from "@/lib/ai/source-router";

describe("lib/ai/source-router: classifySourceRoute", () => {
  const cases: Array<{ question: string; expected: "DATABASE" | "WEB" | "COMBINED" }> = [
    { question: "How many animals are currently on my farm?", expected: "DATABASE" },
    { question: "Which cow produced the most milk this month?", expected: "DATABASE" },
    { question: "How much milk should a 7-day-old dairy calf receive?", expected: "WEB" },
    { question: "What is the normal gestation period of a cow?", expected: "WEB" },
    { question: "How many of my cows are pregnant?", expected: "DATABASE" },
    { question: "Which of my pregnant cows are approaching calving?", expected: "DATABASE" },
    {
      question: "What should I prepare for cows approaching calving?",
      expected: "COMBINED",
    },
    {
      question: "I have a 7-day-old calf weighing 40 kg. How much milk should it receive?",
      expected: "COMBINED",
    },
    { question: "How much medicine do I have in inventory?", expected: "DATABASE" },
    {
      question: "What is the recommended dosage of this medicine for cattle?",
      expected: "WEB",
    },
    {
      question: "What is the latest recommended vaccination protocol for dairy calves?",
      expected: "WEB",
    },
    {
      question: "Which of my calves may be at risk based on their weight and age?",
      expected: "COMBINED",
    },
    { question: "How many animals did we vaccinate last month?", expected: "DATABASE" },
    { question: "What causes mastitis?", expected: "WEB" },
    { question: "Which animals have mastitis records?", expected: "DATABASE" },
    {
      question: "Which of my animals have mastitis records and what signs should I monitor?",
      expected: "COMBINED",
    },
    { question: "Give me a health risk report for my farm.", expected: "COMBINED" },
  ];

  it.each(cases)("routes %# correctly: $expected", ({ question, expected }) => {
    const route = classifySourceRoute(question);
    expect(route.kind).toBe(expected);
  });

  it("never routes herd counts to WEB", () => {
    expect(classifySourceRoute("How many animals are on my farm?").kind).toBe("DATABASE");
    expect(classifySourceRoute("How many cows do I have?").kind).toBe("DATABASE");
  });

  it("routes animal tag lookups to DATABASE", () => {
    expect(classifySourceRoute("Show me GVD-C009's complete history.").kind).toBe("DATABASE");
  });

  it("does not let prior veterinary questions pollute farm count routing", () => {
    const history = [
      { role: "user" as const, content: "What causes mastitis?" },
      { role: "assistant" as const, content: "Mastitis is inflammation of the udder…" },
      { role: "user" as const, content: "How many animals are currently on my farm?" },
    ];
    const latest = history[history.length - 1].content;
    expect(classifySourceRoute(latest, history).kind).toBe("DATABASE");
  });
});
