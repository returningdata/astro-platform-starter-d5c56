import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const DISCORD_CLIENT_ID = Netlify.env.get("DISCORD_CLIENT_ID") || "";
const DISCORD_CLIENT_SECRET = Netlify.env.get("DISCORD_CLIENT_SECRET") || "";
const REDIRECT_URI = Netlify.env.get("URL")
  ? `${Netlify.env.get("URL")}/.netlify/functions/auth-discord-callback`
  : "http://localhost:8888/.netlify/functions/auth-discord-callback";

const DISCORD_GUILD_ID = "1411715697406378116";
const OWNER_ROLE_ID = "1411715697888989286";

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

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
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
    const permissions = getUserPermissions(memberRoles, adminRoles);

    const isAdmin = permissions.length > 0;
    const isOwner = memberRoles.includes(OWNER_ROLE_ID);

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
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };

    // Store session
    const sessionsStore = getStore("sessions");
    await sessionsStore.setJSON(sessionId, sessionData);

    // Redirect to admin page with session cookie
    const response = new Response(null, {
      status: 302,
      headers: {
        Location: isAdmin ? "/admin" : "/?error=not_admin",
        "Set-Cookie": `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
      }
    });

    return response;
  } catch (error) {
    console.error("Auth callback error:", error);
    return Response.redirect("/?error=auth_failed", 302);
  }
};

export const config: Config = {
  path: "/.netlify/functions/auth-discord-callback"
};
