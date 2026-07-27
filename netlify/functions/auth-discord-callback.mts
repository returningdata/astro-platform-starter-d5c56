import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const DISCORD_CLIENT_ID = Netlify.env.get("DISCORD_CLIENT_ID") || "";
const DISCORD_CLIENT_SECRET = Netlify.env.get("DISCORD_CLIENT_SECRET") || "";
const SITE_URL = Netlify.env.get("SITE_URL") || Netlify.env.get("URL") || "http://localhost:8889";
const REDIRECT_URI = Netlify.env.get("DISCORD_REDIRECT_URI") || `${SITE_URL}/api/auth/discord/callback`;

const DISCORD_GUILD_ID = Netlify.env.get("KRUIGER_DISCORD_GUILD_ID") || "1411715697406378116";
const OWNER_ROLE_ID = Netlify.env.get("KRUIGER_OWNER_ROLE_ID") || "1411715697888989286";

// Bootstrap admin: comma-separated Discord user IDs that always get admin access
const ADMIN_USER_IDS = `${Netlify.env.get("ADMIN_USER_IDS") || ""},${Netlify.env.get("AUTHORIZED_STAFF_IDS") || ""}`.split(",").map(id => id.trim()).filter(Boolean);

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  global_name?: string;
}

interface GuildMember {
  user?: DiscordUser;
  roles: string[];
  nick?: string | null;
}

interface AdminRole {
  roleId: string;
  roleName: string;
  permissions: string[];
}

async function getAdminRoles(): Promise<AdminRole[]> {
  const store = getStore("admin-config");
  const roles = await store.get("admin-roles", { type: "json" });

  // Default roles: Owner has all permissions
  const defaultRoles: AdminRole[] = [
    {
      roleId: OWNER_ROLE_ID,
      roleName: "Owner",
      permissions: ["all"]
    }
  ];

  return roles || defaultRoles;
}

function getUserPermissions(memberRoles: string[], adminRoles: AdminRole[]): string[] {
  const permissions: Set<string> = new Set();

  for (const role of adminRoles) {
    if (memberRoles.includes(role.roleId)) {
      for (const perm of role.permissions) {
        if (perm === "all") {
          return ["all"];
        }
        permissions.add(perm);
      }
    }
  }

  return Array.from(permissions);
}

function readCookie(req: Request, name: string) {
  return (req.headers.get("cookie") || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthCookie = readCookie(req, "oauth_state");
  const separator = oauthCookie.indexOf(".");
  const storedState = separator >= 0 ? oauthCookie.slice(0, separator) : "";
  const returnTo = separator >= 0 ? decodeURIComponent(oauthCookie.slice(separator + 1)) : "/customer";

  if (!code || !state || state !== storedState) {
    return Response.redirect("/?error=no_code", 302);
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      console.error("Token exchange failed:", await tokenResponse.text());
      return Response.redirect("/?error=token_failed", 302);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get user info
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!userResponse.ok) {
      return Response.redirect("/?error=user_fetch_failed", 302);
    }

    const user: DiscordUser = await userResponse.json();

    // Get guild member info to check roles
    const memberResponse = await fetch(
      `https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    let memberRoles: string[] = [];
    let isInGuild = false;

    if (memberResponse.ok) {
      const member: GuildMember = await memberResponse.json();
      memberRoles = member.roles;
      isInGuild = true;
    }

    // Get admin roles configuration
    const adminRoles = await getAdminRoles();
    let permissions = getUserPermissions(memberRoles, adminRoles);

    // Check if user is a bootstrap admin via env var
    const isBootstrapAdmin = ADMIN_USER_IDS.includes(user.id);

    // Bootstrap admins get all permissions
    if (isBootstrapAdmin && !permissions.includes("all")) {
      permissions = ["all"];
    }

    const isAdmin = permissions.length > 0 || isBootstrapAdmin;
    const isOwner = memberRoles.includes(OWNER_ROLE_ID) || isBootstrapAdmin;

    // Create session token
    const sessionId = crypto.randomUUID();
    const sessionData = {
      userId: user.id,
      username: user.username,
      displayName: user.global_name || user.username,
      avatar: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : null,
      roles: memberRoles,
      permissions,
      isAdmin,
      isOwner,
      isInGuild,
      csrfToken: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };

    // Store session
    const sessionsStore = getStore("sessions");
    await sessionsStore.setJSON(sessionId, sessionData);

    // Redirect to admin page with session cookie
    const headers = new Headers({ Location: isAdmin && returnTo === "/customer" ? "/admin" : returnTo });
    headers.append("Set-Cookie", `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${SITE_URL.startsWith("https://") ? "; Secure" : ""}`);
    headers.append("Set-Cookie", "oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    const response = new Response(null, { status: 302, headers });

    return response;
  } catch (error) {
    console.error("Auth callback error:", error);
    return Response.redirect("/?error=auth_failed", 302);
  }
};

export const config: Config = {
  path: "/api/auth/discord/callback"
};
