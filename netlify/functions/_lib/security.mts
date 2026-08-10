import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { authSessions, rateLimitBuckets, users } from "../../../db/schema.js";

export interface PortalSession {
  internalUserId: number;
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
  const sessionToken = getCookie(req, "session");
  if (!sessionToken) return null;
  const [record] = await db.select({
    internalUserId: users.id,
    userId: users.discordId,
    username: users.username,
    displayName: users.displayName,
    avatar: users.avatarUrl,
    roles: authSessions.roles,
    permissions: authSessions.permissions,
    isAdmin: authSessions.isAdmin,
    isOwner: authSessions.isOwner,
    isInGuild: authSessions.isInGuild,
    csrfToken: authSessions.csrfToken,
    createdAt: authSessions.createdAt,
    expiresAt: authSessions.expiresAt,
  }).from(authSessions).innerJoin(users, eq(authSessions.userId, users.id)).where(and(eq(authSessions.tokenHash, hashSessionToken(sessionToken)), gt(authSessions.expiresAt, new Date()))).limit(1);
  if (!record) return null;
  return { ...record, createdAt: record.createdAt.toISOString(), expiresAt: record.expiresAt.toISOString() };
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
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

export async function requirePermission(req: Request, permission: string) {
  const session = await requireStaff(req);
  if (!session.isOwner && !session.permissions.includes("all") && !session.permissions.includes(permission)) {
    throw json({ error: "Insufficient staff permission" }, 403);
  }
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

export function hashTrustedIp(ip: string | undefined | null) {
  const secret = Netlify.env.get("SESSION_SECRET") || "local-development";
  return createHash("sha256").update(`${secret}:${ip || "unknown"}`).digest("hex");
}

export function maskIp(ip: string | undefined | null) {
  if (!ip) return "Unavailable";
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}:xxxx`;
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.xxx` : "Unavailable";
}

export async function rateLimit(req: Request, limit = 12, windowMs = 60_000) {
  const bucketKey = `${hashIp(req)}:${new URL(req.url).pathname}`;
  const resetsAt = new Date(Date.now() + windowMs);
  try {
    const result = await db.execute(sql`
      INSERT INTO ${rateLimitBuckets} (key, count, resets_at, updated_at)
      VALUES (${bucketKey}, 1, ${resetsAt}, NOW())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN ${rateLimitBuckets.resetsAt} <= NOW() THEN 1 ELSE ${rateLimitBuckets.count} + 1 END,
        resets_at = CASE WHEN ${rateLimitBuckets.resetsAt} <= NOW() THEN ${resetsAt} ELSE ${rateLimitBuckets.resetsAt} END,
        updated_at = NOW()
      RETURNING count
    `);
    const count = Number((result.rows[0] as { count?: number | string } | undefined)?.count || 1);
    return count <= limit;
  } catch {
    return true;
  }
}
