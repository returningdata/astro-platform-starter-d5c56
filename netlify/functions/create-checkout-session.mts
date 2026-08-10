import type { Context } from "@netlify/functions";
import { randomUUID } from "node:crypto";
import { and, eq, gt, lte, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import { coupons, orderItems, orders, sales, users } from "../../db/schema.js";
import { BUNDLE_SLUG, SOFTWARE_SLUGS, getAccount, getPurchasableItems, getStripe, ownedProductSlugs, siteUrl, writeAudit } from "./_lib/store.mjs";
import { hashTrustedIp, json, maskIp, rateLimit, requireSession, validateMutation } from "./_lib/security.mjs";

const checkoutInput = z.object({
  productSlugs: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1).max(12),
  setupServiceSlugs: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(12).default([]),
  couponCode: z.string().trim().max(40).optional(),
  acknowledgeOwned: z.boolean().default(false),
  bundleChoice: z.enum(["replace", "keep"]).optional(),
});

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!await rateLimit(req, 8, 60_000)) return json({ error: "Too many checkout attempts" }, 429);
  try {
    const session = await requireSession(req);
    if (!validateMutation(req, session)) return json({ error: "Invalid request verification" }, 403);
    const parsed = checkoutInput.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "Invalid cart selection" }, 400);
    const account = await getAccount(session);
    let productSlugs = [...new Set(parsed.data.productSlugs)];
    const serviceSlugs = [...new Set(parsed.data.setupServiceSlugs)];
    const includesBundle = productSlugs.includes(BUNDLE_SLUG);
    const individualInCart = productSlugs.filter((slug) => SOFTWARE_SLUGS.includes(slug as typeof SOFTWARE_SLUGS[number]));
    if (includesBundle && individualInCart.length && !parsed.data.bundleChoice) return json({ error: "The Complete Bot Bundle already includes all five bot products.", code: "bundle_conflict", options: ["replace", "keep"] }, 409);
    if (includesBundle && parsed.data.bundleChoice === "replace") productSlugs = productSlugs.filter((slug) => !SOFTWARE_SLUGS.includes(slug as typeof SOFTWARE_SLUGS[number]));

    const requested = [...productSlugs, ...serviceSlugs];
    const items = await getPurchasableItems(requested);
    if (items.length !== requested.length) return json({ error: "One or more selected items are unavailable or missing a configured Stripe Price ID" }, 409);
    const mainProducts = items.filter(({ product }) => product.productType === "software" || product.productType === "bundle");
    const setupProducts = items.filter(({ product }) => product.productType === "setup_service");
    if (!mainProducts.length && !setupProducts.some(({ product }) => product.slug.startsWith("full-"))) return json({ error: "Select a software product or full setup service" }, 400);
    for (const { product } of setupProducts) {
      if (product.includedProductSlugs.length && !product.includedProductSlugs.some((slug) => productSlugs.includes(slug))) return json({ error: `${product.name} is not available for the selected product` }, 400);
    }

    const owned = await ownedProductSlugs(account.id);
    const ownedInCart = productSlugs.filter((slug) => owned.includes(slug) || (slug === BUNDLE_SLUG && SOFTWARE_SLUGS.some((included) => owned.includes(included))));
    if (ownedInCart.length && !parsed.data.acknowledgeOwned) return json({ error: "You already own one or more selected products. Confirm before purchasing again.", code: "existing_entitlement", owned: ownedInCart }, 409);

    const stripe = getStripe();
    let stripeCustomerId = account.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({ name: account.displayName, metadata: { internal_user_id: String(account.id), discord_user_id: account.discordId } });
      stripeCustomerId = customer.id;
      await db.update(users).set({ stripeCustomerId, updatedAt: new Date() }).where(eq(users.id, account.id));
    }

    const subtotalCents = items.reduce((sum, item) => sum + item.price.amountCents, 0);
    const now = new Date();
    let discount: { promotion_code?: string; coupon?: string } | undefined;
    let couponCode: string | null = null;
    if (parsed.data.couponCode) {
      const code = parsed.data.couponCode.toUpperCase();
      const [coupon] = await db.select().from(coupons).where(and(eq(coupons.code, code), eq(coupons.enabled, true))).limit(1);
      if (!coupon || (coupon.startsAt && coupon.startsAt > now) || (coupon.expiresAt && coupon.expiresAt <= now) || (coupon.maximumUses && coupon.uses >= coupon.maximumUses) || !coupon.stripePromotionCodeId) return json({ error: "Coupon is invalid, expired, unavailable, or not connected to Stripe" }, 400);
      if (coupon.productIds.length && !mainProducts.some(({ product }) => coupon.productIds.includes(product.id))) return json({ error: "Coupon does not apply to the selected products" }, 400);
      const recentPendingCutoff = new Date(now.getTime() - 30 * 60_000);
      const priorUses = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.userId, account.id), eq(orders.couponCode, code), or(eq(orders.paymentStatus, "paid"), eq(orders.paymentStatus, "refunded"), eq(orders.paymentStatus, "partially_refunded"), eq(orders.paymentStatus, "disputed"), and(eq(orders.paymentStatus, "pending"), gt(orders.createdAt, recentPendingCutoff)))));
      if (priorUses.length >= coupon.perUserLimit) return json({ error: "This coupon has reached its per-customer use limit" }, 400);
      discount = { promotion_code: coupon.stripePromotionCodeId };
      couponCode = code;
    } else {
      const activeSales = await db.select().from(sales).where(and(eq(sales.enabled, true), lte(sales.startsAt, now), gt(sales.endsAt, now)));
      const recentPendingCutoff = new Date(now.getTime() - 30 * 60_000);
      for (const candidate of activeSales) {
        if (!candidate.stripeCouponId || subtotalCents < candidate.minimumCartCents || (candidate.maximumUses && candidate.uses >= candidate.maximumUses)) continue;
        if (!candidate.allProducts && !mainProducts.some(({ product }) => candidate.productIds.includes(product.id))) continue;
        const internalCode = `SALE:${candidate.id}`;
        const priorUses = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.userId, account.id), eq(orders.couponCode, internalCode), or(eq(orders.paymentStatus, "paid"), eq(orders.paymentStatus, "refunded"), eq(orders.paymentStatus, "partially_refunded"), eq(orders.paymentStatus, "disputed"), and(eq(orders.paymentStatus, "pending"), gt(orders.createdAt, recentPendingCutoff)))));
        if (priorUses.length >= candidate.perUserLimit) continue;
        discount = { coupon: candidate.stripeCouponId };
        couponCode = internalCode;
        break;
      }
    }

    const orderId = randomUUID();
    const [order] = await db.insert(orders).values({ id: orderId, userId: account.id, subtotalCents, totalCents: subtotalCents, currency: "usd", stripeCustomerId, couponCode, ipHash: hashTrustedIp(context.ip), maskedIp: maskIp(context.ip) }).returning();
    const orderNumber = `KL-${new Date().getUTCFullYear()}-${String(order.sequenceId).padStart(6, "0")}`;
    await db.update(orders).set({ orderNumber, updatedAt: new Date() }).where(eq(orders.id, order.id));
    await db.insert(orderItems).values(items.map(({ product, price }) => ({ orderId: order.id, productId: product.id, priceId: price.id, productName: product.name, productSlug: product.slug, itemType: product.productType === "setup_service" ? "setup_service" : "product", unitAmountCents: price.amountCents, totalAmountCents: price.amountCents, stripePriceId: price.stripePriceId, metadata: { applicableProducts: product.includedProductSlugs } })));

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: stripeCustomerId,
      line_items: items.map(({ price }) => ({ price: price.stripePriceId!, quantity: 1 })),
      discounts: discount ? [discount] : undefined,
      success_url: `${siteUrl()}/checkout/success/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/checkout/cancel/`,
      client_reference_id: account.discordId,
      metadata: { order_id: order.id, order_number: orderNumber, internal_user_id: String(account.id), discord_user_id: account.discordId },
      payment_intent_data: { metadata: { order_id: order.id, order_number: orderNumber, internal_user_id: String(account.id), discord_user_id: account.discordId } },
    }, { idempotencyKey: `checkout-${order.id}` });
    await db.update(orders).set({ stripeCheckoutSessionId: checkout.id, updatedAt: new Date() }).where(eq(orders.id, order.id));
    await writeAudit(account.id, "order_creation", "order", order.id, { orderNumber, productSlugs, serviceSlugs }, hashTrustedIp(context.ip));
    return json({ checkoutUrl: checkout.url, orderNumber });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Checkout creation failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Unable to start secure checkout" }, 500);
  }
};


