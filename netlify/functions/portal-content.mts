import type { Config } from "@netlify/functions";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import { documentationArticles, products, services } from "../../db/schema.js";
import { getSession, json, rateLimit, sanitizeText } from "./_lib/security.mjs";

export default async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!rateLimit(req, 60)) return json({ error: "Too many requests" }, 429);
  const url = new URL(req.url);
  const resource = url.searchParams.get("resource") || "products";
  const session = await getSession(req);
  if (resource === "products") return json({ items: await db.select().from(products).where(eq(products.published, true)).orderBy(products.name) });
  if (resource === "services") return json({ items: await db.select().from(services).orderBy(services.name) });
  if (resource === "search") {
    const query = sanitizeText(url.searchParams.get("q"), 100);
    if (query.length < 2) return json({ items: [] });
    const access = session ? eq(documentationArticles.status, "published") : and(eq(documentationArticles.status, "published"), eq(documentationArticles.customerOnly, false));
    const items = await db.select({ title: documentationArticles.title, excerpt: documentationArticles.summary, slug: documentationArticles.slug, version: documentationArticles.version, updatedAt: documentationArticles.updatedAt }).from(documentationArticles).where(and(access, or(ilike(documentationArticles.title, `%${query}%`), ilike(documentationArticles.summary, `%${query}%`), ilike(documentationArticles.searchKeywords, `%${query}%`)))).orderBy(desc(documentationArticles.updatedAt)).limit(12);
    return json({ items: items.map((item) => ({ ...item, category: "Documentation", href: `/docs/${item.slug}` })) });
  }
  return json({ error: "Unknown content resource" }, 404);
};

export const config: Config = { path: "/api/docs/content" };
