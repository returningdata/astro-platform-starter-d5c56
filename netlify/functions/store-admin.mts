import type { Config } from "@netlify/functions";
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import { auditLogs, coupons, disputes, entitlements, orderItems, orders, productPrices, products, refunds, sales, setupServices, staffNotes, users } from "../../db/schema.js";
import { sendDiscordWebhook } from "./_lib/discord-webhook.mjs";
import { getStripe, hasStaffPermission, siteUrl, writeAudit } from "./_lib/store.mjs";
import { json, rateLimit, requireStaff, sanitizeText, validateMutation } from "./_lib/security.mjs";

const productInput = z.object({ name: z.string().min(2).max(120), slug: z.string().regex(/^[a-z0-9-]+$/), description: z.string().min(10).max(500), fullDescription: z.string().min(10).max(6000), category: z.string().min(2).max(100), amountCents: z.number().int().min(50).max(5_000_000), currency: z.string().length(3).default("usd"), stripeProductId: z.string().max(100).optional(), stripePriceId: z.string().max(100).optional(), createInStripe: z.boolean().default(false), logoUrl: z.string().max(500).optional(), documentationUrl: z.string().max(500).optional(), currentVersion: z.string().max(80).default("1.0"), status: z.enum(["draft", "active", "coming_soon", "hidden", "paused", "discontinued", "out_of_sale"]).default("draft"), featured: z.boolean().default(false), saleEligible: z.boolean().default(true), setupEligible: z.boolean().default(false), requirements: z.array(z.string().max(500)).default([]), externalIntegrations: z.array(z.string().max(500)).default([]), includedProductSlugs: z.array(z.string().max(100)).default([]), sortOrder: z.number().int().min(0).max(10000).default(0), productType: z.enum(["software", "bundle", "setup_service", "custom"]).default("software") });
const saleInput = z.object({ name: z.string().min(2).max(120), description: z.string().max(1000).default(""), startsAt: z.string().datetime(), endsAt: z.string().datetime(), discountType: z.enum(["percent", "fixed"]), discountValue: z.number().int().positive(), productIds: z.array(z.number().int()).default([]), allProducts: z.boolean().default(false), minimumCartCents: z.number().int().min(0).default(0), maximumUses: z.number().int().positive().optional(), perUserLimit: z.number().int().positive().default(1), enabled: z.boolean().default(true), publicBadge: z.string().max(80).optional(), banner: z.string().max(500).optional(), stripeCouponId: z.string().max(100).optional() });
const couponInput = z.object({ code: z.string().regex(/^[A-Z0-9_-]{3,40}$/), description: z.string().max(1000).default(""), discountType: z.enum(["percent", "fixed"]), discountValue: z.number().int().positive(), startsAt: z.string().datetime().optional(), expiresAt: z.string().datetime().optional(), productIds: z.array(z.number().int()).default([]), maximumUses: z.number().int().positive().optional(), perUserLimit: z.number().int().positive().default(1), enabled: z.boolean().default(true), stripePromotionCodeId: z.string().max(100).optional() });

function resourceFrom(req: Request) {
  return new URL(req.url).pathname.split("/api/staff/store/")[1]?.split("/")[0] || "dashboard";
}

async function auditAdmin(session: Awaited<ReturnType<typeof requireStaff>>, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown>) {
  await writeAudit(session.internalUserId, action, entityType, entityId, metadata);
  await sendDiscordWebhook("DISCORD_STORE_AUDIT_WEBHOOK_URL", { title: action.split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" "), severity: action.includes("suspend") || action.includes("disabled") ? "warning" : "info", fields: [{ name: "Staff", value: `${session.displayName} (@${session.username})` }, { name: "Staff Discord ID", value: session.userId }, { name: "Entity", value: `${entityType}${entityId ? ` · ${entityId}` : ""}` }, { name: "Staff store", value: `${siteUrl()}/staff/store/` }] });
}

export default async (req: Request) => {
  try {
    const session = await requireStaff(req);
    const resource = resourceFrom(req);
    if (req.method !== "GET" && !await rateLimit(req, 40, 60_000)) return json({ error: "Too many staff changes. Try again shortly." }, 429);
    if (req.method !== "GET" && !validateMutation(req, session)) return json({ error: "Invalid request verification" }, 403);
    const url = new URL(req.url);

    if (req.method === "GET" && resource === "dashboard") {
      if (!hasStaffPermission(session, "store.analytics.view")) return json({ error: "Insufficient permission" }, 403);
      const [allOrders, allProducts, allSales, allSetup, allDisputes, recentRefunds, recentAudit] = await Promise.all([db.select().from(orders), db.select().from(products).where(eq(products.commerceEnabled, true)), db.select().from(sales), db.select().from(setupServices), db.select().from(disputes), db.select().from(refunds).orderBy(desc(refunds.createdAt)).limit(8), db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(12)]);
      const today = new Date(); today.setUTCHours(0, 0, 0, 0);
      const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      const paid = allOrders.filter((order) => ["paid", "partially_refunded", "disputed"].includes(order.paymentStatus));
      return json({ metrics: { revenueCents: paid.reduce((sum, order) => sum + order.totalCents, 0), ordersToday: allOrders.filter((order) => order.createdAt >= today).length, ordersThisMonth: allOrders.filter((order) => order.createdAt >= month).length, productsSold: paid.length, activeProducts: allProducts.filter((product) => product.status === "active").length, disabledProducts: allProducts.filter((product) => product.status !== "active").length, activeSales: allSales.filter((sale) => sale.enabled && sale.startsAt <= new Date() && sale.endsAt > new Date()).length, pendingSetup: allSetup.filter((service) => !["completed", "cancelled"].includes(service.status)).length, openDisputes: allDisputes.filter((dispute) => !["won", "lost", "warning_closed"].includes(dispute.status)).length }, recentOrders: allOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10), recentRefunds, recentAudit });
    }

    if (req.method === "GET" && resource === "products") {
      if (!hasStaffPermission(session, "store.products.view")) return json({ error: "Insufficient permission" }, 403);
      const rows = await db.select({ product: products, price: productPrices }).from(products).leftJoin(productPrices, and(eq(productPrices.productId, products.id), eq(productPrices.active, true))).where(eq(products.commerceEnabled, true)).orderBy(products.sortOrder, products.name);
      return json({ items: rows });
    }
    if (req.method === "POST" && resource === "products") {
      if (!hasStaffPermission(session, "store.products.manage")) return json({ error: "Insufficient permission" }, 403);
      const parsed = productInput.safeParse(await req.json().catch(() => null)); if (!parsed.success) return json({ error: "Invalid product fields", details: parsed.error.issues }, 400);
      let stripeProductId = parsed.data.stripeProductId || null; let stripePriceId = parsed.data.stripePriceId || null;
      if (parsed.data.createInStripe) { const stripe = getStripe(); const stripeProduct = await stripe.products.create({ name: parsed.data.name, description: parsed.data.description, metadata: { kruiger_slug: parsed.data.slug } }); stripeProductId = stripeProduct.id; const price = await stripe.prices.create({ product: stripeProduct.id, unit_amount: parsed.data.amountCents, currency: parsed.data.currency }); stripePriceId = price.id; }
      const [created] = await db.insert(products).values({ name: parsed.data.name, slug: parsed.data.slug, description: parsed.data.description, fullDescription: parsed.data.fullDescription, category: parsed.data.category, status: parsed.data.status, productType: parsed.data.productType, logoUrl: parsed.data.logoUrl || null, documentationUrl: parsed.data.documentationUrl || null, currentVersion: parsed.data.currentVersion, stripeProductId, featured: parsed.data.featured, saleEligible: parsed.data.saleEligible, setupEligible: parsed.data.setupEligible, commerceEnabled: true, published: parsed.data.status !== "hidden" && parsed.data.status !== "draft", requirements: parsed.data.requirements, externalIntegrations: parsed.data.externalIntegrations, includedProductSlugs: parsed.data.includedProductSlugs, sortOrder: parsed.data.sortOrder }).returning();
      await db.insert(productPrices).values({ productId: created.id, amountCents: parsed.data.amountCents, currency: parsed.data.currency, stripePriceId, active: true, createdBy: session.internalUserId });
      await auditAdmin(session, "admin_product_created", "product", String(created.id), { slug: created.slug }); return json({ item: created }, 201);
    }
    if (req.method === "PATCH" && resource === "products") {
      if (!hasStaffPermission(session, "store.products.manage")) return json({ error: "Insufficient permission" }, 403);
      const body = await req.json() as Record<string, unknown>; const productId = Number(body.productId); const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1); if (!product) return json({ error: "Product not found" }, 404);
      if (body.action === "status") { const status = z.enum(["draft", "active", "coming_soon", "hidden", "paused", "discontinued", "out_of_sale"]).parse(body.status); await db.update(products).set({ status, published: status !== "hidden" && status !== "draft", updatedAt: new Date(), availabilityMessage: sanitizeText(body.message, 300) || null }).where(eq(products.id, product.id)); await auditAdmin(session, status === "paused" ? "admin_product_disabled" : "admin_product_status_changed", "product", String(product.id), { status }); return json({ success: true }); }
      if (body.action === "price") { const amountCents = z.number().int().min(50).max(5_000_000).parse(body.amountCents); let stripePriceId = sanitizeText(body.stripePriceId, 100) || null; if (body.createInStripe) { const stripe = getStripe(); let stripeProductId = product.stripeProductId; if (!stripeProductId) { const created = await stripe.products.create({ name: product.name, description: product.description, metadata: { kruiger_slug: product.slug } }); stripeProductId = created.id; await db.update(products).set({ stripeProductId }).where(eq(products.id, product.id)); } stripePriceId = (await stripe.prices.create({ product: stripeProductId, unit_amount: amountCents, currency: "usd" })).id; } await db.update(productPrices).set({ active: false, retiredAt: new Date(), updatedAt: new Date() }).where(and(eq(productPrices.productId, product.id), eq(productPrices.active, true))); const [price] = await db.insert(productPrices).values({ productId: product.id, amountCents, currency: "usd", stripePriceId, active: true, createdBy: session.internalUserId }).returning(); await auditAdmin(session, "admin_price_changed", "product", String(product.id), { newPriceId: price.id, amountCents }); return json({ price }); }
      return json({ error: "Unknown product action" }, 400);
    }

    if (req.method === "GET" && resource === "orders") {
      if (!hasStaffPermission(session, "store.orders.view")) return json({ error: "Insufficient permission" }, 403);
      const status = url.searchParams.get("status"); const query = url.searchParams.get("q")?.slice(0, 120);
      let rows = await db.select({ order: orders, customer: users }).from(orders).innerJoin(users, eq(orders.userId, users.id)).orderBy(desc(orders.createdAt)).limit(250);
      if (status) rows = rows.filter(({ order }) => order.paymentStatus === status || order.fulfillmentStatus === status);
      if (query) { const normalized = query.toLowerCase(); rows = rows.filter(({ order, customer }) => [order.orderNumber, order.stripePaymentIntentId, customer.discordId, customer.username, customer.email, String(customer.id)].some((value) => value?.toLowerCase().includes(normalized))); }
      const ids = rows.map(({ order }) => order.id); const items = ids.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids)) : [];
      return json({ items: rows.map((row) => ({ ...row, items: items.filter((item) => item.orderId === row.order.id) })) });
    }
    if (req.method === "PATCH" && resource === "orders") {
      if (!hasStaffPermission(session, "store.orders.manage")) return json({ error: "Insufficient permission" }, 403);
      const body = await req.json() as Record<string, unknown>; const orderId = String(body.orderId || ""); const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1); if (!order) return json({ error: "Order not found" }, 404);
      if (body.action === "suspend" || body.action === "restore") { if (!hasStaffPermission(session, "store.entitlements.manage")) return json({ error: "Insufficient permission" }, 403); const restore = body.action === "restore"; await db.update(entitlements).set({ status: restore ? "active" : "suspended_pending_review", suspensionReason: restore ? null : sanitizeText(body.reason, 300) || "staff_override", suspendedAt: restore ? null : new Date(), restoredAt: restore ? new Date() : null, updatedAt: new Date() }).where(eq(entitlements.orderId, order.id)); await db.update(orders).set({ fulfillmentStatus: restore ? "fulfilled" : "suspended", updatedAt: new Date() }).where(eq(orders.id, order.id)); await auditAdmin(session, restore ? "admin_entitlement_restored" : "admin_entitlement_suspended", "order", order.id, { reason: sanitizeText(body.reason, 300) }); return json({ success: true }); }
      if (body.action === "note") { const note = sanitizeText(body.note, 4000); if (!note) return json({ error: "Note is required" }, 400); await db.insert(staffNotes).values({ entityType: "order", entityId: order.id, authorId: session.internalUserId, note }); await auditAdmin(session, "admin_order_note_added", "order", order.id, {}); return json({ success: true }); }
      return json({ error: "Unknown order action" }, 400);
    }

    if (req.method === "GET" && resource === "customers") {
      if (!hasStaffPermission(session, "store.customers.view")) return json({ error: "Insufficient permission" }, 403);
      const query = (url.searchParams.get("q") || "").slice(0, 120); if (query.length < 2) return json({ items: [] });
      const customerRows = await db.select().from(users).where(or(ilike(users.username, `%${query}%`), ilike(users.discordId, `%${query}%`), ilike(users.email, `%${query}%`), ilike(users.stripeCustomerId, `%${query}%`))).limit(50);
      const customerIds = customerRows.map((user) => user.id); const customerOrders = customerIds.length ? await db.select().from(orders).where(inArray(orders.userId, customerIds)) : []; const access = customerIds.length ? await db.select().from(entitlements).where(inArray(entitlements.userId, customerIds)) : [];
      return json({ items: customerRows.map((customer) => ({ customer: { ...customer, lastLoginIpHash: undefined }, orders: customerOrders.filter((order) => order.userId === customer.id), entitlements: access.filter((item) => item.userId === customer.id) })) });
    }

    if (req.method === "GET" && resource === "setup") { if (!hasStaffPermission(session, "store.setup.manage")) return json({ error: "Insufficient permission" }, 403); const items = await db.select({ service: setupServices, product: products, customer: users, order: orders }).from(setupServices).innerJoin(products, eq(setupServices.productId, products.id)).innerJoin(users, eq(setupServices.userId, users.id)).innerJoin(orders, eq(setupServices.orderId, orders.id)).orderBy(desc(setupServices.createdAt)); return json({ items }); }
    if (req.method === "PATCH" && resource === "setup") { if (!hasStaffPermission(session, "store.setup.manage")) return json({ error: "Insufficient permission" }, 403); const body = await req.json() as Record<string, unknown>; const id = String(body.id || ""); const status = z.enum(["awaiting_customer_information", "ready_for_setup", "in_progress", "waiting_on_customer", "testing", "completed", "cancelled"]).parse(body.status); await db.update(setupServices).set({ status, customerVisibleNote: sanitizeText(body.customerVisibleNote, 2000) || null, assignedTo: body.assignedTo ? Number(body.assignedTo) : null, startedAt: status === "in_progress" ? new Date() : undefined, completedAt: status === "completed" ? new Date() : undefined, updatedAt: new Date() }).where(eq(setupServices.id, id)); await auditAdmin(session, "setup_service_status_changed", "setup_service", id, { status }); return json({ success: true }); }

    if (req.method === "GET" && resource === "sales") { if (!hasStaffPermission(session, "store.sales.view")) return json({ error: "Insufficient permission" }, 403); return json({ items: await db.select().from(sales).orderBy(desc(sales.startsAt)), coupons: await db.select().from(coupons).orderBy(desc(coupons.createdAt)) }); }
    if (req.method === "POST" && resource === "sales") { if (!hasStaffPermission(session, "store.sales.manage")) return json({ error: "Insufficient permission" }, 403); const body = await req.json(); if (body.kind === "coupon") { const parsed = couponInput.safeParse(body); if (!parsed.success) return json({ error: "Invalid coupon fields" }, 400); const [created] = await db.insert(coupons).values({ ...parsed.data, code: parsed.data.code.toUpperCase(), startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null, expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null, createdBy: session.internalUserId }).returning(); await auditAdmin(session, "admin_coupon_created", "coupon", created.id, { code: created.code }); return json({ item: created }, 201); } const parsed = saleInput.safeParse(body); if (!parsed.success) return json({ error: "Invalid sale fields" }, 400); if (new Date(parsed.data.endsAt) <= new Date(parsed.data.startsAt)) return json({ error: "Sale end must be after its start" }, 400); const [created] = await db.insert(sales).values({ ...parsed.data, startsAt: new Date(parsed.data.startsAt), endsAt: new Date(parsed.data.endsAt), createdBy: session.internalUserId }).returning(); await auditAdmin(session, "admin_sale_created", "sale", created.id, { name: created.name }); return json({ item: created }, 201); }
    if (req.method === "PATCH" && resource === "sales") { if (!hasStaffPermission(session, "store.sales.manage")) return json({ error: "Insufficient permission" }, 403); const body = await req.json() as Record<string, unknown>; const id = String(body.id || ""); const enabled = Boolean(body.enabled); if (body.kind === "coupon") await db.update(coupons).set({ enabled, updatedAt: new Date() }).where(eq(coupons.id, id)); else await db.update(sales).set({ enabled, updatedAt: new Date() }).where(eq(sales.id, id)); await auditAdmin(session, enabled ? "admin_sale_activated" : "admin_sale_ended", String(body.kind || "sale"), id, {}); return json({ success: true }); }

    if (req.method === "GET" && resource === "logs") { if (!hasStaffPermission(session, "store.logs.view")) return json({ error: "Insufficient permission" }, 403); return json({ items: await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(300), disputes: await db.select().from(disputes).orderBy(desc(disputes.createdAt)).limit(100), refunds: await db.select().from(refunds).orderBy(desc(refunds.createdAt)).limit(100) }); }
    return json({ error: "Unknown store resource" }, 404);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Store admin request failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Unable to complete staff store request" }, 500);
  }
};

export const config: Config = { path: "/api/staff/store/*" };

