import type { Config } from "@netlify/functions";

// Discord OAuth2 configuration
const DISCORD_CLIENT_ID = Netlify.env.get("DISCORD_CLIENT_ID") || "";
const SITE_URL = Netlify.env.get("SITE_URL") || Netlify.env.get("URL") || "http://localhost:8889";
const REDIRECT_URI = Netlify.env.get("DISCORD_REDIRECT_URI") || `${SITE_URL}/api/auth/discord/callback`;

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/customer";
  return value.slice(0, 300);
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "login") {
    const state = crypto.randomUUID();
    const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
    const scopes = ["identify", "guilds", "guilds.members.read"];
    const authUrl = new URL("https://discord.com/api/oauth2/authorize");
    authUrl.searchParams.set("client_id", DISCORD_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("state", state);

    return new Response(null, {
      status: 302,
      headers: {
        Location: authUrl.toString(),
        "Set-Cookie": `oauth_state=${state}.${encodeURIComponent(returnTo)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${SITE_URL.startsWith("https://") ? "; Secure" : ""}`,
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
