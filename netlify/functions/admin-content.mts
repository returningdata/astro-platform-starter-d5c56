import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

interface SessionData {
  userId: string;
  username: string;
  permissions: string[];
  isAdmin: boolean;
  isOwner: boolean;
}

interface ContentItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
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
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const contentType = pathParts[pathParts.length - 1]; // skills, tools, bots, or services

  const validTypes = ["skills", "tools", "bots", "services"];
  if (!validTypes.includes(contentType)) {
    return new Response(JSON.stringify({ error: "Invalid content type" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const contentStore = getStore("site-content");

  // GET requests are public
  if (req.method === "GET") {
    const items: ContentItem[] = await contentStore.get(contentType, { type: "json" });
    return new Response(JSON.stringify({ [contentType]: items || [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  // All other methods require authentication
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

  // Check permission for the specific content type
  const permissionMap: Record<string, string> = {
    skills: "manage_skills",
    tools: "manage_tools",
    bots: "manage_bots",
    services: "manage_services"
  };

  if (!hasPermission(session, permissionMap[contentType])) {
    return new Response(JSON.stringify({ error: `No permission to manage ${contentType}` }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (req.method === "POST") {
    const body = await req.json();
    const { name, description, icon, image } = body;

    if (!name) {
      return new Response(JSON.stringify({ error: "Name is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    let items: ContentItem[] = await contentStore.get(contentType, { type: "json" });
    if (!items) items = [];

    const newItem: ContentItem = {
      id: crypto.randomUUID(),
      name,
      description,
      icon,
      image,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: session.userId
    };

    items.push(newItem);
    await contentStore.setJSON(contentType, items);

    return new Response(JSON.stringify({ success: true, item: newItem, [contentType]: items }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (req.method === "PUT") {
    const body = await req.json();
    const { id, name, description, icon, image } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: "ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    let items: ContentItem[] = await contentStore.get(contentType, { type: "json" });
    if (!items) {
      return new Response(JSON.stringify({ error: "Item not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const itemIndex = items.findIndex((i) => i.id === id);
    if (itemIndex < 0) {
      return new Response(JSON.stringify({ error: "Item not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    items[itemIndex] = {
      ...items[itemIndex],
      name: name || items[itemIndex].name,
      description: description !== undefined ? description : items[itemIndex].description,
      icon: icon !== undefined ? icon : items[itemIndex].icon,
      image: image !== undefined ? image : items[itemIndex].image,
      updatedAt: new Date().toISOString()
    };

    await contentStore.setJSON(contentType, items);

    return new Response(
      JSON.stringify({ success: true, item: items[itemIndex], [contentType]: items }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  if (req.method === "DELETE") {
    const itemId = url.searchParams.get("id");

    if (!itemId) {
      return new Response(JSON.stringify({ error: "ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    let items: ContentItem[] = await contentStore.get(contentType, { type: "json" });
    if (!items) {
      return new Response(JSON.stringify({ error: "Item not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const originalLength = items.length;
    items = items.filter((i) => i.id !== itemId);

    if (items.length === originalLength) {
      return new Response(JSON.stringify({ error: "Item not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    await contentStore.setJSON(contentType, items);

    return new Response(JSON.stringify({ success: true, [contentType]: items }), {
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
  path: ["/api/admin/skills", "/api/admin/tools", "/api/admin/bots", "/api/admin/services"]
};
