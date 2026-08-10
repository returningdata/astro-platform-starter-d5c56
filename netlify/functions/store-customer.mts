import type { Config } from "@netlify/functions";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { downloads, entitlements, orderItems, orders, products, setupServices, supportTickets, users } from "../../db/schema.js";
import { json, requireSession } from "./_lib/security.mjs";

export default async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  try {
    const session = await requireSession(req);
    const [account] = await db.select().from(users).where(eq(users.id, session.internalUserId)).limit(1);
    const customerOrders = await db.select().from(orders).where(eq(orders.userId, session.internalUserId)).orderBy(desc(orders.createdAt));
    const orderIds = customerOrders.map((order) => order.id);
    const items = orderIds.length ? await db.select().from(orderItems).where((await import("drizzle-orm")).inArray(orderItems.orderId, orderIds)) : [];
    const access = await db.select({ entitlement: entitlements, product: products, order: orders }).from(entitlements).innerJoin(products, eq(entitlements.productId, products.id)).innerJoin(orders, eq(entitlements.orderId, orders.id)).where(eq(entitlements.userId, session.internalUserId));
    const setup = await db.select({ service: setupServices, productName: products.name, productSlug: products.slug, orderNumber: orders.orderNumber }).from(setupServices).innerJoin(products, eq(setupServices.productId, products.id)).innerJoin(orders, eq(setupServices.orderId, orders.id)).where(eq(setupServices.userId, session.internalUserId)).orderBy(desc(setupServices.createdAt));
    const tickets = await db.select().from(supportTickets).where(eq(supportTickets.userId, session.internalUserId)).orderBy(desc(supportTickets.createdAt));
    const recentDownloads = await db.select().from(downloads).where(eq(downloads.userId, session.internalUserId)).orderBy(desc(downloads.createdAt)).limit(20);
    return json({
      profile: { internalUserId: account?.id, discordId: account?.discordId, username: account?.username, displayName: account?.displayName, avatar: account?.avatarUrl, accountStatus: account?.accountStatus, createdAt: account?.createdAt },
      orders: customerOrders.map((order) => ({ ...order, items: items.filter((item) => item.orderId === order.id) })),
      entitlements: access.map(({ entitlement, product, order }) => ({ ...entitlement, productName: product.name, productSlug: product.slug, documentationUrl: product.documentationUrl, version: product.currentVersion, downloadAvailable: entitlement.status === "active" && Boolean(product.artifactKey), orderNumber: order.orderNumber })),
      setupServices: setup,
      tickets,
      downloads: recentDownloads,
      csrfToken: session.csrfToken,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "Unable to load customer purchases" }, 500);
  }
};

export const config: Config = { path: "/api/customer/store" };

