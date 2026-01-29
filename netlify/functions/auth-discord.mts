import type { Context, Config } from "@netlify/functions";

// Discord OAuth2 configuration
const DISCORD_CLIENT_ID = Netlify.env.get("DISCORD_CLIENT_ID") || "";
const DISCORD_CLIENT_SECRET = Netlify.env.get("DISCORD_CLIENT_SECRET") || "";
const REDIRECT_URI = Netlify.env.get("URL")
  ? `${Netlify.env.get("URL")}/api/auth/discord/callback`
  : "http://localhost:8888/api/auth/discord/callback";

const DISCORD_GUILD_ID = "1411715697406378116"; // KruigerLabs Discord server
const OWNER_ROLE_ID = "1411715697888989286"; // Owner role

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "login") {
    const scopes = ["identify", "guilds", "guilds.members.read"];
    const authUrl = new URL("https://discord.com/api/oauth2/authorize");
    authUrl.searchParams.set("client_id", DISCORD_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes.join(" "));

    return Response.redirect(authUrl.toString(), 302);
  }

  return new Response(JSON.stringify({ error: "Invalid action" }), {
    status: 400,
    headers: { "Content-Type": "application/json" }
  });
};

export const config: Config = {
  path: "/api/auth/discord"
};
