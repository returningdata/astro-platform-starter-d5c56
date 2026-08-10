import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import { auditLogs, supportAttachments, supportMessages, supportTickets, users } from "../../db/schema.js";
import { getSession, hashIp, json, rateLimit, sanitizeText, validateMutation } from "./_lib/security.mjs";

const ticketSchema = z.object({
  customerName: z.string().min(2).max(120), discordUsername: z.string().min(2).max(80),
  discordUserId: z.string().regex(/^\d{15,22}$/), email: z.string().email().max(180),
  product: z.string().min(2).max(120), serverName: z.string().max(120).optional(),
  serverId: z.string().max(22).optional(), category: z.string().min(2).max(80),
  priority: z.enum(["low", "normal", "high", "urgent", "critical", "service-issue"]),
  subject: z.string().min(4).max(180), description: z.string().min(20).max(8000),
  stepsAttempted: z.string().max(4000).optional(), relevantCommand: z.string().max(120).optional(),
  relatedRecordId: z.string().max(120).optional(), errorMessage: z.string().max(3000).optional(),
  diagnosticConsent: z.boolean().default(false),
});

async function resolveUser(discordId?: string) {
  if (!discordId) return null;
  const [user] = await db.select().from(users).where(eq(users.discordId, discordId)).limit(1);
  return user || null;
}

export default async (req: Request) => {
  if (!await rateLimit(req, 10, 60_000)) return json({ error: "Too many requests" }, 429);
  const session = await getSession(req);
  const url = new URL(req.url);

  if (req.method === "GET") {
    if (!session) return json({ error: "Authentication required" }, 401);
    const user = await resolveUser(session.userId);
    if (!user) return json({ tickets: [] });
    const rows = await db.select().from(supportTickets).where(eq(supportTickets.userId, user.id)).orderBy(desc(supportTickets.updatedAt));
    return json({ tickets: rows });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!validateMutation(req, session)) return json({ error: "Invalid CSRF token or origin" }, 403);

  if (url.searchParams.get("action") === "reply") {
    if (!session) return json({ error: "Authentication required" }, 401);
    const body = await req.json().catch(() => null) as { ticketNumber?: string; message?: string } | null;
    const message = sanitizeText(body?.message, 5000);
    if (!body?.ticketNumber || message.length < 2) return json({ error: "Invalid reply" }, 400);
    const user = await resolveUser(session.userId);
    if (!user) return json({ error: "Customer profile not found" }, 404);
    const [ticket] = await db.select().from(supportTickets).where(and(eq(supportTickets.ticketNumber, body.ticketNumber), eq(supportTickets.userId, user.id))).limit(1);
    if (!ticket) return json({ error: "Ticket not found" }, 404);
    await db.insert(supportMessages).values({ ticketId: ticket.id, authorId: user.id, authorType: "customer", message });
    await db.update(supportTickets).set({ status: "open", updatedAt: new Date() }).where(eq(supportTickets.id, ticket.id));
    return json({ ok: true }, 201);
  }

  const contentType = req.headers.get("content-type") || "";
  let raw: Record<string, unknown> = {};
  let files: File[] = [];
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    for (const [key, value] of form.entries()) {
      if (value instanceof File) files.push(value); else raw[key] = value;
    }
    raw.diagnosticConsent = raw.diagnosticConsent === "true" || raw.diagnosticConsent === "on";
  } else raw = await req.json().catch(() => ({}));
  const parsed = ticketSchema.safeParse(raw);
  if (!parsed.success) return json({ error: "Please check the required support fields", details: parsed.error.flatten().fieldErrors }, 400);
  if (files.length > 5) return json({ error: "A maximum of five files is allowed" }, 400);
  const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "text/plain", "application/pdf"]);
  if (files.some((file) => !allowedTypes.has(file.type) || file.size > 5_000_000)) return json({ error: "Files must be PNG, JPG, WebP, TXT, or PDF and under 5 MB" }, 400);

  const user = await resolveUser(session?.userId);
  const ticketNumber = `KL-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const clean = (value: unknown, length = 5000) => sanitizeText(value, length) || null;
  const [ticket] = await db.insert(supportTickets).values({
    ticketNumber, userId: user?.id ?? null, customerName: clean(parsed.data.customerName, 120)!,
    discordUsername: clean(parsed.data.discordUsername, 80)!, discordUserId: parsed.data.discordUserId,
    email: parsed.data.email.toLowerCase(), product: clean(parsed.data.product, 120)!, serverName: clean(parsed.data.serverName, 120),
    serverId: clean(parsed.data.serverId, 22), category: clean(parsed.data.category, 80)!, priority: parsed.data.priority,
    subject: clean(parsed.data.subject, 180)!, description: clean(parsed.data.description, 8000)!,
    stepsAttempted: clean(parsed.data.stepsAttempted, 4000), relevantCommand: clean(parsed.data.relevantCommand, 120),
    relatedRecordId: clean(parsed.data.relatedRecordId, 120), errorMessage: clean(parsed.data.errorMessage, 3000),
    diagnosticConsent: parsed.data.diagnosticConsent,
  }).returning();

  const store = getStore({ name: "support-attachments", consistency: "strong" });
  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    const blobKey = `${ticketNumber}/${crypto.randomUUID()}-${safeName}`;
    await store.set(blobKey, await file.arrayBuffer());
    await db.insert(supportAttachments).values({ ticketId: ticket.id, blobKey, fileName: safeName, contentType: file.type, size: file.size });
  }
  await db.insert(auditLogs).values({ action: "support.ticket.created", entityType: "support_ticket", entityId: String(ticket.id), actorId: user?.id ?? null, ipHash: hashIp(req), metadata: { ticketNumber, category: ticket.category } });

  const webhook = Netlify.env.get("SUPPORT_WEBHOOK_URL");
  if (webhook) {
    await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: `New support ticket ${ticketNumber}: ${ticket.subject}` }) }).catch(() => null);
  }
  return json({ ok: true, ticketNumber }, 201);
};

export const config: Config = { path: "/api/support/tickets" };

