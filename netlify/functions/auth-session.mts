import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

interface SessionData {
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  roles: string[];
  permissions: string[];
  isAdmin: boolean;
  isOwner: boolean;
  isInGuild: boolean;
  createdAt: string;
  expiresAt: string;
}

function getSessionIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name === "session") {
      return value;
    }
  }
  return null;
}

export default async (req: Request, context: Context) => {
  const sessionId = getSessionIdFromCookie(req.headers.get("cookie"));

  if (!sessionId) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const sessionsStore = getStore("sessions");
    const session: SessionData | null = await sessionsStore.get(sessionId, { type: "json" });

    if (!session) {
      return new Response(JSON.stringify({ authenticated: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Check if session is expired
    if (new Date(session.expiresAt) < new Date()) {
      await sessionsStore.delete(sessionId);
      return new Response(
        JSON.stringify({ authenticated: false, error: "Session expired" }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": "session=; Path=/; HttpOnly; Max-Age=0"
          }
        }
      );
    }

    return new Response(
      JSON.stringify({
        authenticated: true,
        user: {
          id: session.userId,
          username: session.username,
          displayName: session.displayName,
          avatar: session.avatar,
          isAdmin: session.isAdmin,
          isOwner: session.isOwner,
          permissions: session.permissions
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Session check error:", error);
    return new Response(JSON.stringify({ authenticated: false, error: "Session error" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const config: Config = {
  path: "/api/auth/session"
};
