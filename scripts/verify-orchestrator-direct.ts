/** Direct orchestrator smoke test — does not print API keys. */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const { geminiModelCandidates } = await import("../lib/ai/gemini-config");
  console.log("model_candidates", geminiModelCandidates().join(" -> "));

  const { runAssistant } = await import("../lib/ai/orchestrator");
  const result = await runAssistant({
    history: [{ role: "user", content: "How many animals are on my farm?" }],
    ctx: { userId: "verify-script", role: "ADMIN" },
  });

  console.log("sourceRoute", result.sourceRoute);
  console.log("toolsUsed", result.toolsUsed.join(",") || "none");
  console.log("message_length", result.message.length);
  console.log("PASS");
}

main().catch((e) => {
  const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "UNKNOWN";
  const message = e instanceof Error ? e.message : String(e);
  console.error("FAIL:", code, "-", message.slice(0, 200));
  process.exit(1);
});
