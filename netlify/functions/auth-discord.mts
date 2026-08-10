import type { Config } from "@netlify/functions";
import { createHash, randomBytes } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { json, rateLimit } from "./_lib/security.mjs";

// Discord OAuth2 configuration
const DISCORD_CLIENT_ID = Netlify.env.get("DISCORD_OAUTH_CLIENT_ID") || Netlify.env.get("DISCORD_CLIENT_ID") || "";
const SITE_URL = Netlify.env.get("SITE_URL") || Netlify.env.get("URL") || "http://localhost:8889";
const REDIRECT_URI = Netlify.env.get("DISCORD_OAUTH_REDIRECT_URI") || Netlify.env.get("DISCORD_REDIRECT_URI") || `${SITE_URL}/api/auth/discord/callback`;

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/customer";
  return value.slice(0, 300);
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "login") {
    if (!await rateLimit(req, 12, 5 * 60_000)) return json({ error: "Too many login attempts" }, 429);
    if (!DISCORD_CLIENT_ID) return new Response(JSON.stringify({ error: "Discord OAuth is not configured" }), { status: 503, headers: { "Content-Type": "application/json" } });
    const state = crypto.randomUUID();
    const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
    const verifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    await getStore({ name: "oauth-transactions", consistency: "strong" }).setJSON(state, { returnTo, verifier, expiresAt: Date.now() + 10 * 60 * 1000 });
    const scopes = ["identify", "guilds.members.read"];
    const authUrl = new URL("https://discord.com/api/oauth2/authorize");
    authUrl.searchParams.set("client_id", DISCORD_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    return new Response(null, {
      status: 302,
      headers: {
        Location: authUrl.toString(),
        "Set-Cookie": `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${SITE_URL.startsWith("https://") ? "; Secure" : ""}`,
      },
    });
  }

  return new Response(JSON.stringify({ error: "Invalid action" }), {
    status: 400,
    headers: { "Content-Type": "application/json" }
  });
};

export const config: Config = {
  path: "/api/auth/discord"
};
