import type { Context, Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { authSessions } from "../../db/schema.js";
import { hashSessionToken } from "./_lib/security.mjs";

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
      await db.delete(authSessions).where(eq(authSessions.tokenHash, hashSessionToken(sessionId)));
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
