import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const OWNER_ROLE_ID = "1411715697888989286";

interface SessionData {
  userId: string;
  username: string;
  permissions: string[];
  isAdmin: boolean;
  isOwner: boolean;
}

interface AdminRole {
  roleId: string;
  roleName: string;
  permissions: string[];
}

function getSessionIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name === "session") return value;
  }
  return null;
}

async function getSession(sessionId: string): Promise<SessionData | null> {
  const store = getStore("sessions");
  return await store.get(sessionId, { type: "json" });
}

function hasPermission(session: SessionData, permission: string): boolean {
  if (session.isOwner) return true;
  if (session.permissions.includes("all")) return true;
  return session.permissions.includes(permission);
}

export default async (req: Request, context: Context) => {
  const sessionId = getSessionIdFromCookie(req.headers.get("cookie"));

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const session = await getSession(sessionId);
  if (!session || !session.isAdmin) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const configStore = getStore("admin-config");

  if (req.method === "GET") {
    // Only owners can view roles
    if (!session.isOwner) {
      return new Response(JSON.stringify({ error: "Only owners can manage roles" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    const roles = await configStore.get("admin-roles", { type: "json" });
    const defaultRoles: AdminRole[] = [
      { roleId: OWNER_ROLE_ID, roleName: "Owner", permissions: ["all"] }
    ];

    return new Response(JSON.stringify({ roles: roles || defaultRoles }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (req.method === "POST") {
    // Only owners can add roles
    if (!session.isOwner) {
      return new Response(JSON.stringify({ error: "Only owners can manage roles" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const { roleId, roleName, permissions } = body;

    if (!roleId || !roleName || !permissions) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    let roles: AdminRole[] = await configStore.get("admin-roles", { type: "json" });
    if (!roles) {
      roles = [{ roleId: OWNER_ROLE_ID, roleName: "Owner", permissions: ["all"] }];
    }

    // Check if role already exists
    const existingIndex = roles.findIndex((r) => r.roleId === roleId);
    if (existingIndex >= 0) {
      roles[existingIndex] = { roleId, roleName, permissions };
    } else {
      roles.push({ roleId, roleName, permissions });
    }

    await configStore.setJSON("admin-roles", roles);

    return new Response(JSON.stringify({ success: true, roles }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (req.method === "DELETE") {
    // Only owners can delete roles
    if (!session.isOwner) {
      return new Response(JSON.stringify({ error: "Only owners can manage roles" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    const url = new URL(req.url);
    const roleId = url.searchParams.get("roleId");

    if (!roleId) {
      return new Response(JSON.stringify({ error: "Missing roleId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Cannot delete owner role
    if (roleId === OWNER_ROLE_ID) {
      return new Response(JSON.stringify({ error: "Cannot delete owner role" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    let roles: AdminRole[] = await configStore.get("admin-roles", { type: "json" });
    if (!roles) {
      return new Response(JSON.stringify({ error: "No roles found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    roles = roles.filter((r) => r.roleId !== roleId);
    await configStore.setJSON("admin-roles", roles);

    return new Response(JSON.stringify({ success: true, roles }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" }
  });
};

export const config: Config = {
  path: "/api/admin/roles"
};
