import type { Config } from "@netlify/functions";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { orderItems, orders, products, setupServices } from "../../db/schema.js";
import { json, requireSession } from "./_lib/security.mjs";

export default async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  try {
    const session = await requireSession(req);
    const sessionId = new URL(req.url).searchParams.get("session_id") || "";
    const [order] = await db.select().from(orders).where(and(eq(orders.stripeCheckoutSessionId, sessionId), eq(orders.userId, session.internalUserId))).limit(1);
    if (!order) return json({ error: "Order not found" }, 404);
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    const setup = await db.select().from(setupServices).where(eq(setupServices.orderId, order.id));
    return json({ order: { orderNumber: order.orderNumber, paymentStatus: order.paymentStatus, fulfillmentStatus: order.fulfillmentStatus, subtotalCents: order.subtotalCents, discountCents: order.discountCents, totalCents: order.totalCents, currency: order.currency, createdAt: order.createdAt }, items, setupServices: setup });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "Unable to verify checkout result" }, 500);
  }
};

export const config: Config = { path: "/api/store/checkout-result" };

