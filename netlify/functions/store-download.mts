import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { downloads, entitlements, orders, products } from "../../db/schema.js";
import { hashTrustedIp, json, rateLimit, requireSession } from "./_lib/security.mjs";
import { writeAudit } from "./_lib/store.mjs";

export default async (req: Request, context: Context) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!await rateLimit(req, 20, 60_000)) return json({ error: "Download rate limit reached. Try again shortly." }, 429);
  try {
    const session = await requireSession(req);
    const slug = new URL(req.url).searchParams.get("product") || "";
    const [record] = await db.select({ entitlement: entitlements, product: products, order: orders }).from(entitlements).innerJoin(products, eq(entitlements.productId, products.id)).innerJoin(orders, eq(entitlements.orderId, orders.id)).where(and(eq(entitlements.userId, session.internalUserId), eq(products.slug, slug))).limit(1);
    const allowed = record && record.entitlement.status === "active" && record.order.paymentStatus === "paid" && (!record.entitlement.abuseLockedUntil || record.entitlement.abuseLockedUntil <= new Date()) && (!record.entitlement.maximumDownloads || record.entitlement.downloadCount < record.entitlement.maximumDownloads);
    if (!allowed || !record.product.artifactKey) {
      if (record) await db.insert(downloads).values({ userId: session.internalUserId, productId: record.product.id, orderId: record.order.id, entitlementId: record.entitlement.id, version: record.product.currentVersion, result: "denied", ipHash: hashTrustedIp(context.ip) });
      await writeAudit(session.internalUserId, "download_denied", "product", slug, { reason: record?.entitlement.status || "no_entitlement" }, hashTrustedIp(context.ip));
      return json({ error: "Download access is unavailable for this product" }, 403);
    }
    const blob = await getStore({ name: "store-artifacts", consistency: "strong" }).get(record.product.artifactKey, { type: "blob" });
    if (!blob) return json({ error: "The current product file is unavailable. Contact support." }, 503);
    await db.transaction(async (tx) => {
      await tx.insert(downloads).values({ userId: session.internalUserId, productId: record.product.id, orderId: record.order.id, entitlementId: record.entitlement.id, version: record.product.currentVersion, result: "delivered", ipHash: hashTrustedIp(context.ip) });
      await tx.update(entitlements).set({ downloadCount: sql`${entitlements.downloadCount} + 1`, updatedAt: new Date() }).where(eq(entitlements.id, record.entitlement.id));
    });
    await writeAudit(session.internalUserId, "download_performed", "product", String(record.product.id), { orderNumber: record.order.orderNumber, version: record.product.currentVersion }, hashTrustedIp(context.ip));
    const filename = record.product.artifactKey.split("/").pop()?.replace(/[^a-zA-Z0-9._-]/g, "-") || `${slug}.zip`;
    return new Response(blob.stream(), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Download failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Unable to process download" }, 500);
  }
};

export const config: Config = { path: ["/.netlify/functions/store-download", "/api/store/download"] };

