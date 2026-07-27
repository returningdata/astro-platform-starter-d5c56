import { createHash, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

export interface PortalSession {
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  roles: string[];
  permissions: string[];
  isAdmin: boolean;
  isOwner: boolean;
  isInGuild: boolean;
  csrfToken: string;
  createdAt: string;
  expiresAt: string;
}

export function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

export function getCookie(req: Request, name: string) {
  const cookie = req.headers.get("cookie") || "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

export async function getSession(req: Request): Promise<PortalSession | null> {
  const sessionId = getCookie(req, "session");
  if (!sessionId) return null;
  const session = await getStore("sessions").get(sessionId, { type: "json" }) as PortalSession | null;
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;
  return session;
}

export async function requireSession(req: Request) {
  const session = await getSession(req);
  if (!session) throw new Response(JSON.stringify({ error: "Authentication required" }), { status: 401 });
  return session;
}

export async function requireStaff(req: Request) {
  const session = await requireSession(req);
  if (!session.isAdmin) throw new Response(JSON.stringify({ error: "Staff access required" }), { status: 403 });
  return session;
}

export function validateMutation(req: Request, session?: PortalSession | null) {
  const siteUrl = Netlify.env.get("SITE_URL") || Netlify.env.get("URL");
  const origin = req.headers.get("origin");
  if (siteUrl && origin && new URL(siteUrl).origin !== origin) return false;
  if (!session) return true;
  const supplied = req.headers.get("x-csrf-token") || "";
  if (!supplied || !session.csrfToken) return false;
  const first = Buffer.from(supplied);
  const second = Buffer.from(session.csrfToken);
  return first.length === second.length && timingSafeEqual(first, second);
}

export function sanitizeText(value: unknown, maxLength = 5000) {
  return String(value ?? "").replace(/[<>\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, maxLength);
}

export function hashIp(req: Request) {
  const secret = Netlify.env.get("SESSION_SECRET") || "local-development";
  const ip = req.headers.get("x-nf-client-connection-ip") || "unknown";
  return createHash("sha256").update(`${secret}:${ip}`).digest("hex");
}

const requests = new Map<string, { count: number; reset: number }>();
export function rateLimit(req: Request, limit = 12, windowMs = 60_000) {
  const key = hashIp(req);
  const now = Date.now();
  const current = requests.get(key);
  if (!current || current.reset <= now) {
    requests.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
