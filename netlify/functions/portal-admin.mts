import type { Config } from "@netlify/functions";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import { auditLogs, changelogEntries, documentationArticles, products, services, supportTickets, users } from "../../db/schema.js";
import { hashIp, json, requireStaff, sanitizeText, validateMutation } from "./_lib/security.mjs";

const articleInput = z.object({ slug: z.string().min(2).max(180).regex(/^[a-z0-9-]+$/), title: z.string().min(2).max(180), summary: z.string().min(2).max(500), content: z.string().min(2).max(100_000), status: z.enum(["draft", "published", "unpublished"]), customerOnly: z.boolean().default(false), version: z.string().max(40).default("1.0"), searchKeywords: z.string().max(1000).default("") });
const productInput = z.object({ slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/), name: z.string().min(2).max(160), description: z.string().min(10).max(3000), category: z.string().min(2).max(100), status: z.string().max(50), accessType: z.string().max(50), customerOnly: z.boolean().default(false), logoUrl: z.string().max(500).optional(), published: z.boolean().default(true) });
const serviceInput = z.object({ slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/), name: z.string().min(2).max(160), status: z.enum(["operational", "degraded", "partial-outage", "major-outage", "maintenance"]), publicMessage: z.string().max(1000).optional() });
const ticketStatusInput = z.object({ status: z.enum(["open", "assigned", "waiting-for-customer", "under-investigation", "escalated", "resolved", "closed"]) });

async function actorId(discordId: string) {
  const [actor] = await db.select().from(users).where(eq(users.discordId, discordId)).limit(1);
  return actor?.id ?? null;
}

export default async (req: Request) => {
  try {
    const session = await requireStaff(req);
    const url = new URL(req.url);
    const resource = url.searchParams.get("resource") || "articles";
    if (req.method === "GET") {
      if (resource === "articles") return json({ items: await db.select().from(documentationArticles).orderBy(desc(documentationArticles.updatedAt)) });
      if (resource === "products") return json({ items: await db.select().from(products).orderBy(products.name) });
      if (resource === "services") return json({ items: await db.select().from(services).orderBy(services.name) });
      if (resource === "tickets") return json({ items: await db.select().from(supportTickets).orderBy(desc(supportTickets.updatedAt)) });
      if (resource === "changelog") return json({ items: await db.select().from(changelogEntries).orderBy(desc(changelogEntries.releaseDate)) });
      return json({ error: "Unknown resource" }, 404);
    }
    if (!validateMutation(req, session)) return json({ error: "Invalid CSRF token or origin" }, 403);
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return json({ error: "Invalid request" }, 400);
    const id = Number(url.searchParams.get("id"));
    let entityId = id ? String(id) : "";
    if (req.method === "POST" && resource === "articles") {
      const parsed = articleInput.safeParse(body); if (!parsed.success) return json({ error: "Invalid article", details: parsed.error.flatten().fieldErrors }, 400);
      const [created] = await db.insert(documentationArticles).values({ ...parsed.data, title: sanitizeText(parsed.data.title,180), summary: sanitizeText(parsed.data.summary,500), content: sanitizeText(parsed.data.content,100_000), publishedAt: parsed.data.status === "published" ? new Date() : null }).returning(); entityId=String(created.id);
    } else if (req.method === "POST" && resource === "products") {
      const parsed=productInput.safeParse(body); if(!parsed.success)return json({error:"Invalid product",details:parsed.error.flatten().fieldErrors},400); const [created]=await db.insert(products).values(parsed.data).returning();entityId=String(created.id);
    } else if (req.method === "POST" && resource === "services") {
      const parsed=serviceInput.safeParse(body); if(!parsed.success)return json({error:"Invalid service",details:parsed.error.flatten().fieldErrors},400); const [created]=await db.insert(services).values(parsed.data).returning();entityId=String(created.id);
    } else if (req.method === "PATCH" && resource === "articles" && id) {
      const parsed=articleInput.partial().safeParse(body);if(!parsed.success)return json({error:"Invalid article"},400);await db.update(documentationArticles).set({...parsed.data,updatedAt:new Date(),publishedAt:parsed.data.status==='published'?new Date():undefined}).where(eq(documentationArticles.id,id));
    } else if (req.method === "PATCH" && resource === "products" && id) {
      const parsed=productInput.partial().safeParse(body);if(!parsed.success)return json({error:"Invalid product"},400);await db.update(products).set({...parsed.data,updatedAt:new Date()}).where(eq(products.id,id));
    } else if (req.method === "PATCH" && resource === "services" && id) {
      const parsed=serviceInput.partial().safeParse(body);if(!parsed.success)return json({error:"Invalid service"},400);await db.update(services).set({...parsed.data,updatedAt:new Date()}).where(eq(services.id,id));
    } else if (req.method === "PATCH" && resource === "tickets" && id) {
      const parsed=ticketStatusInput.safeParse(body);if(!parsed.success)return json({error:"Invalid ticket status"},400);await db.update(supportTickets).set({status:parsed.data.status,updatedAt:new Date()}).where(eq(supportTickets.id,id));
    } else return json({ error: "Unsupported operation" }, 400);
    await db.insert(auditLogs).values({ actorId: await actorId(session.userId), action: `docs.${resource}.${req.method.toLowerCase()}`, entityType: resource, entityId, ipHash: hashIp(req), metadata: {} });
    return json({ ok: true, id: entityId }, req.method === "POST" ? 201 : 200);
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "Staff operation failed" }, 500);
  }
};

export const config: Config = { path: "/api/staff/docs" };
