import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

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

  if (sessionId) {
    try {
      const sessionsStore = getStore("sessions");
      await sessionsStore.delete(sessionId);
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": "session=; Path=/; HttpOnly; Max-Age=0"
    }
  });
};

export const config: Config = {
  path: "/api/auth/logout"
};
