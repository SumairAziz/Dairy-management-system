/**
 * Verifies GEMINI_API_KEY is loaded from .env.local and assistant chat responds.
 * Does NOT print the API key or any secret values.
 *
 * Usage: npx tsx scripts/verify-assistant-chat.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const BASE = process.env.NEXTAUTH_URL || "http://localhost:3000";
const EMAIL = process.env.VERIFY_ASSISTANT_EMAIL || "admin@terradairy.local";
const PASSWORD = process.env.VERIFY_ASSISTANT_PASSWORD || "TD_Admin_2026!";

class CookieJar {
  private cookies = new Map<string, string>();

  absorb(response: Response) {
    const lines =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];
    for (const line of lines) {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) {
        this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    }
  }

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  hasSession(): boolean {
    return [...this.cookies.keys()].some((k) => k.includes("session-token"));
  }
}

async function main() {
  const keyConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  console.log("env_file", ".env.local");
  console.log("GEMINI_API_KEY_configured", keyConfigured);
  console.log("AI_PROVIDER", process.env.AI_PROVIDER || "(default openai)");
  console.log("GEMINI_MODEL", process.env.GEMINI_MODEL || "(default gemini-2.0-flash)");

  if (!keyConfigured) {
    console.error("FAIL: GEMINI_API_KEY is missing or empty in .env.local");
    process.exit(1);
  }

  const { requireGeminiApiKey } = await import("../lib/ai/gemini-config");
  requireGeminiApiKey();
  console.log("local_key_validation", "passed");

  const jar = new CookieJar();

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { redirect: "manual" });
  jar.absorb(csrfRes);
  const csrfJson = (await csrfRes.json()) as { csrfToken?: string };
  const csrfToken = csrfJson.csrfToken;
  if (!csrfToken) {
    console.error("FAIL: could not obtain auth CSRF token — is the dev server running?");
    process.exit(1);
  }

  const signInRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
    },
    body: new URLSearchParams({
      csrfToken,
      email: EMAIL,
      password: PASSWORD,
      callbackUrl: `${BASE}/animals/assistant`,
    }).toString(),
    redirect: "manual",
  });
  jar.absorb(signInRes);

  if (signInRes.status >= 300 && signInRes.status < 400) {
    const location = signInRes.headers.get("location");
    if (location) {
      const followRes = await fetch(location.startsWith("http") ? location : `${BASE}${location}`, {
        headers: { Cookie: jar.header() },
        redirect: "manual",
      });
      jar.absorb(followRes);
    }
  }

  if (!jar.hasSession()) {
    console.error("FAIL: login did not establish a session cookie (sign-in status", signInRes.status, ")");
    process.exit(1);
  }
  console.log("auth", "session established");

  const chatRes = await fetch(`${BASE}/api/assistant/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: jar.header(),
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: "How many animals are on my farm?" }],
    }),
  });

  const chatJson = (await chatRes.json()) as {
    success?: boolean;
    data?: { message?: string; toolsUsed?: string[]; sourceRoute?: string };
    error?: { code?: string; message?: string };
  };

  console.log("chat_status", chatRes.status);
  if (chatRes.ok && chatJson.success && chatJson.data) {
    console.log("chat_sourceRoute", chatJson.data.sourceRoute ?? "unknown");
    console.log("chat_toolsUsed", (chatJson.data.toolsUsed ?? []).join(",") || "none");
    console.log("chat_message_length", chatJson.data.message?.length ?? 0);
    console.log("PASS: assistant chat responded");
    return;
  }

  console.error("FAIL:", chatJson.error?.code ?? "UNKNOWN", "-", chatJson.error?.message ?? "no message");
  process.exit(1);
}

main().catch((e) => {
  console.error("FAIL:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
