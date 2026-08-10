import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "../../db/index.js";
import { coupons, disputes, entitlements, orderItems, orders, payments, processedStripeEvents, productLicences, products, refunds, sales, setupServices, users } from "../../db/schema.js";
import { sendDiscordWebhook } from "./_lib/discord-webhook.mjs";
import { formatMoney, getStripe, siteUrl, writeAudit } from "./_lib/store.mjs";
import { json } from "./_lib/security.mjs";

function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id || null;
}

async function claimEvent(event: Stripe.Event) {
  const [existing] = await db.select().from(processedStripeEvents).where(eq(processedStripeEvents.stripeEventId, event.id)).limit(1);
  if (existing?.status === "processed" || existing?.status === "processing") return false;
  if (existing) {
    await db.update(processedStripeEvents).set({ status: "processing", errorMessage: null }).where(eq(processedStripeEvents.id, existing.id));
    return true;
  }
  await db.insert(processedStripeEvents).values({ stripeEventId: event.id, eventType: event.type, status: "processing" });
  return true;
}

async function orderContext(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  const [customer] = await db.select().from(users).where(eq(users.id, order.userId)).limit(1);
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return { order, customer, items };
}

async function grantProduct(userId: number, orderId: string, productId: number) {
  await db.insert(entitlements).values({ userId, orderId, productId, status: "active" }).onConflictDoNothing();
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (product) await db.insert(productLicences).values({ userId, productId, licenceReference: `KL-LIC-${randomUUID().toUpperCase()}`, status: "active", metadata: { orderId } }).onConflictDoNothing();
}

async function fulfillCheckout(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  if (!orderId) throw new Error("Checkout Session is missing order_id metadata");
  const context = await orderContext(orderId);
  if (!context) throw new Error("Order not found for Checkout Session");
  const paymentIntentId = stripeId(session.payment_intent);
  const paidAt = new Date((session.created || Math.floor(Date.now() / 1000)) * 1000);
  await db.update(orders).set({ paymentStatus: "paid", fulfillmentStatus: "fulfilled", stripePaymentIntentId: paymentIntentId, stripeCustomerId: stripeId(session.customer), totalCents: session.amount_total || context.order.totalCents, subtotalCents: session.amount_subtotal || context.order.subtotalCents, discountCents: Math.max(0, (session.amount_subtotal || 0) - (session.amount_total || 0)), paidAt, fulfilledAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, orderId));
  if (context.order.paymentStatus !== "paid" && context.order.couponCode) {
    if (context.order.couponCode.startsWith("SALE:")) await db.update(sales).set({ uses: sql`${sales.uses} + 1`, updatedAt: new Date() }).where(eq(sales.id, context.order.couponCode.slice(5)));
    else await db.update(coupons).set({ uses: sql`${coupons.uses} + 1`, updatedAt: new Date() }).where(eq(coupons.code, context.order.couponCode));
  }
  if (paymentIntentId) await db.insert(payments).values({ orderId, stripePaymentIntentId: paymentIntentId, status: "succeeded", amountCents: session.amount_total || context.order.totalCents, currency: session.currency || "usd" }).onConflictDoUpdate({ target: payments.stripePaymentIntentId, set: { status: "succeeded", amountCents: session.amount_total || context.order.totalCents, updatedAt: new Date() } });

  const purchasedProducts = context.items.filter((item) => item.itemType === "product");
  for (const item of purchasedProducts) {
    await grantProduct(context.order.userId, orderId, item.productId);
    const [product] = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
    if (product?.productType === "bundle" && product.includedProductSlugs.length) {
      const included = await db.select().from(products).where(inArray(products.slug, product.includedProductSlugs));
      for (const includedProduct of included) await grantProduct(context.order.userId, orderId, includedProduct.id);
    }
  }
  for (const item of context.items.filter((entry) => entry.itemType === "setup_service")) {
    await db.insert(setupServices).values({ orderId, orderItemId: item.id, userId: context.order.userId, productId: item.productId, status: "awaiting_customer_information" }).onConflictDoNothing();
  }
  await db.update(users).set({ isCustomer: true, stripeCustomerId: stripeId(session.customer), updatedAt: new Date() }).where(eq(users.id, context.order.userId));
  await writeAudit(context.order.userId, "payment_success", "order", orderId, { orderNumber: context.order.orderNumber, stripeCheckoutSessionId: session.id, stripePaymentIntentId: paymentIntentId });
  const refreshed = await orderContext(orderId);
  if (!refreshed) return;
  const fields = [
    { name: "Order", value: refreshed.order.orderNumber || orderId, inline: true },
    { name: "Discord customer", value: `${refreshed.customer?.displayName || "Unknown"} (@${refreshed.customer?.username || "unknown"})`, inline: true },
    { name: "Discord ID", value: refreshed.customer?.discordId || "Unavailable", inline: true },
    { name: "Internal customer ID", value: String(refreshed.order.userId), inline: true },
    { name: "Products", value: refreshed.items.filter((item) => item.itemType === "product").map((item) => item.productName).join("\n") || "None" },
    { name: "Setup services", value: refreshed.items.filter((item) => item.itemType === "setup_service").map((item) => item.productName).join("\n") || "None" },
    { name: "Subtotal", value: formatMoney(session.amount_subtotal || refreshed.order.subtotalCents, session.currency || "usd"), inline: true },
    { name: "Discount", value: formatMoney(Math.max(0, (session.amount_subtotal || 0) - (session.amount_total || 0)), session.currency || "usd"), inline: true },
    { name: "Total paid", value: formatMoney(session.amount_total || refreshed.order.totalCents, session.currency || "usd"), inline: true },
    { name: "Stripe Checkout Session", value: session.id },
    { name: "Stripe Payment Intent", value: paymentIntentId || "Unavailable" },
    { name: "Fulfillment", value: "Fulfilled", inline: true },
    { name: "Customer profile", value: `${siteUrl()}/staff/store/customers/?id=${refreshed.order.userId}` },
    { name: "Staff order", value: `${siteUrl()}/staff/store/orders/?order=${encodeURIComponent(refreshed.order.orderNumber || orderId)}` },
  ];
  if (Netlify.env.get("PAYMENT_LOG_INCLUDE_MASKED_IP") === "true") fields.push({ name: "Network", value: refreshed.order.maskedIp || "Unavailable" });
  await sendDiscordWebhook("DISCORD_PAYMENT_LOG_WEBHOOK_URL", { title: "New Kruiger Labs Order", severity: "success", fields });
}

async function findOrderByPaymentIntent(paymentIntentId: string | null) {
  if (!paymentIntentId) return null;
  const [order] = await db.select().from(orders).where(eq(orders.stripePaymentIntentId, paymentIntentId)).limit(1);
  return order || null;
}

async function handlePaymentIntent(intent: Stripe.PaymentIntent, succeeded: boolean) {
  const orderId = intent.metadata?.order_id;
  const order = orderId ? (await orderContext(orderId))?.order : await findOrderByPaymentIntent(intent.id);
  if (!order) return;
  await db.update(orders).set({ paymentStatus: succeeded ? "paid" : "failed", stripePaymentIntentId: intent.id, updatedAt: new Date() }).where(eq(orders.id, order.id));
  await db.insert(payments).values({ orderId: order.id, stripePaymentIntentId: intent.id, status: succeeded ? "succeeded" : "failed", amountCents: intent.amount, currency: intent.currency, failureCode: intent.last_payment_error?.code || null, failureMessage: intent.last_payment_error?.message?.slice(0, 500) || null }).onConflictDoUpdate({ target: payments.stripePaymentIntentId, set: { status: succeeded ? "succeeded" : "failed", failureCode: intent.last_payment_error?.code || null, failureMessage: intent.last_payment_error?.message?.slice(0, 500) || null, updatedAt: new Date() } });
  if (!succeeded) {
    await writeAudit(order.userId, "payment_failure", "order", order.id, { paymentIntentId: intent.id, failureCode: intent.last_payment_error?.code || null });
    await sendDiscordWebhook("DISCORD_STRIPE_SECURITY_WEBHOOK_URL", { title: "Stripe Payment Failed", severity: "warning", fields: [{ name: "Order", value: order.orderNumber || order.id }, { name: "Payment Intent", value: intent.id }, { name: "Amount", value: formatMoney(intent.amount, intent.currency) }, { name: "Failure", value: intent.last_payment_error?.message?.slice(0, 500) || "Stripe reported a payment failure" }, { name: "Staff order", value: `${siteUrl()}/staff/store/orders/?order=${encodeURIComponent(order.orderNumber || order.id)}` }] });
  }
}

async function handleRefund(refund: Stripe.Refund) {
  const paymentIntentId = stripeId(refund.payment_intent);
  const order = await findOrderByPaymentIntent(paymentIntentId);
  if (!order) return;
  await db.insert(refunds).values({ orderId: order.id, stripeRefundId: refund.id, stripePaymentIntentId: paymentIntentId, amountCents: refund.amount, currency: refund.currency, status: refund.status || "pending", reason: refund.reason || null }).onConflictDoUpdate({ target: refunds.stripeRefundId, set: { status: refund.status || "pending", amountCents: refund.amount, updatedAt: new Date() } });
  const fullRefund = refund.amount >= order.totalCents;
  await db.update(orders).set({ paymentStatus: fullRefund ? "refunded" : "partially_refunded", fulfillmentStatus: fullRefund ? "revoked" : "suspended", updatedAt: new Date() }).where(eq(orders.id, order.id));
  await db.update(entitlements).set({ status: fullRefund ? "revoked" : "suspended_pending_review", suspensionReason: "refund", suspendedAt: new Date(), revokedAt: fullRefund ? new Date() : null, updatedAt: new Date() }).where(eq(entitlements.orderId, order.id));
  await writeAudit(order.userId, "refund_received", "order", order.id, { refundId: refund.id, amount: refund.amount, status: refund.status, entitlementAction: fullRefund ? "revoked" : "suspended" });
  const context = await orderContext(order.id);
  await sendDiscordWebhook("DISCORD_STRIPE_SECURITY_WEBHOOK_URL", { title: "Stripe Refund Received", severity: "warning", fields: [{ name: "Order", value: order.orderNumber || order.id }, { name: "Discord user", value: context?.customer ? `${context.customer.displayName} (${context.customer.discordId})` : "Unavailable" }, { name: "Products", value: context?.items.map((item) => item.productName).join("\n") || "Unavailable" }, { name: "Refund amount", value: formatMoney(refund.amount, refund.currency), inline: true }, { name: "Original amount", value: formatMoney(order.totalCents, order.currency), inline: true }, { name: "Payment Intent", value: paymentIntentId || "Unavailable" }, { name: "Refund ID", value: refund.id }, { name: "Status", value: refund.status || "pending", inline: true }, { name: "Entitlement action", value: fullRefund ? "Revoked" : "Suspended pending review", inline: true }] });
}

async function handleDispute(dispute: Stripe.Dispute, eventType: string, previousStatus?: string) {
  const paymentIntentId = stripeId(dispute.payment_intent);
  const chargeId = stripeId(dispute.charge);
  let order = await findOrderByPaymentIntent(paymentIntentId);
  if (!order && chargeId) {
    const [payment] = await db.select().from(payments).where(eq(payments.stripeChargeId, chargeId)).limit(1);
    if (payment) [order] = await db.select().from(orders).where(eq(orders.id, payment.orderId)).limit(1);
  }
  if (!order) throw new Error(`Order not found for dispute ${dispute.id}`);
  await db.insert(disputes).values({ orderId: order.id, stripeDisputeId: dispute.id, stripePaymentIntentId: paymentIntentId, stripeChargeId: chargeId, reason: dispute.reason, status: dispute.status, previousStatus: previousStatus || null, amountCents: dispute.amount, currency: dispute.currency, openedAt: new Date(dispute.created * 1000), closedAt: eventType === "charge.dispute.closed" ? new Date() : null }).onConflictDoUpdate({ target: disputes.stripeDisputeId, set: { previousStatus: previousStatus || null, status: dispute.status, reason: dispute.reason, closedAt: eventType === "charge.dispute.closed" ? new Date() : null, updatedAt: new Date() } });
  let entitlementAction = "Suspended Pending Review";
  if (eventType === "charge.dispute.created") {
    await db.update(orders).set({ paymentStatus: "disputed", fulfillmentStatus: "suspended", updatedAt: new Date() }).where(eq(orders.id, order.id));
    await db.update(entitlements).set({ status: "suspended_pending_review", suspensionReason: "stripe_dispute", suspendedAt: new Date(), updatedAt: new Date() }).where(eq(entitlements.orderId, order.id));
  } else if (eventType === "charge.dispute.closed") {
    if (dispute.status === "won") {
      entitlementAction = "Restored";
      await db.update(orders).set({ paymentStatus: "paid", fulfillmentStatus: "fulfilled", updatedAt: new Date() }).where(eq(orders.id, order.id));
      await db.update(entitlements).set({ status: "active", suspensionReason: null, restoredAt: new Date(), updatedAt: new Date() }).where(eq(entitlements.orderId, order.id));
    } else if (dispute.status === "lost") {
      entitlementAction = "Revoked";
      await db.update(orders).set({ paymentStatus: "disputed_lost", fulfillmentStatus: "revoked", updatedAt: new Date() }).where(eq(orders.id, order.id));
      await db.update(entitlements).set({ status: "revoked", suspensionReason: "stripe_dispute_lost", revokedAt: new Date(), updatedAt: new Date() }).where(eq(entitlements.orderId, order.id));
    }
  }
  await writeAudit(order.userId, eventType.replaceAll(".", "_"), "order", order.id, { disputeId: dispute.id, previousStatus, status: dispute.status, reason: dispute.reason, entitlementAction });
  const context = await orderContext(order.id);
  const title = eventType === "charge.dispute.created" ? "Stripe Dispute Opened" : eventType === "charge.dispute.updated" ? "Stripe Dispute Updated" : "Stripe Dispute Closed";
  await sendDiscordWebhook("DISCORD_STRIPE_SECURITY_WEBHOOK_URL", { title, severity: eventType === "charge.dispute.closed" && dispute.status === "won" ? "success" : "critical", fields: [{ name: "Order", value: order.orderNumber || order.id }, { name: "Customer", value: context?.customer ? `${context.customer.displayName} (@${context.customer.username})` : "Unavailable" }, { name: "Discord ID", value: context?.customer?.discordId || "Unavailable", inline: true }, { name: "Internal customer ID", value: String(order.userId), inline: true }, { name: "Products", value: context?.items.map((item) => item.productName).join("\n") || "Unavailable" }, { name: "Amount disputed", value: formatMoney(dispute.amount, dispute.currency), inline: true }, { name: "Payment Intent", value: paymentIntentId || "Unavailable" }, { name: "Charge ID", value: chargeId || "Unavailable" }, { name: "Dispute ID", value: dispute.id }, ...(previousStatus ? [{ name: "Previous status", value: previousStatus, inline: true }] : []), { name: "Current status", value: dispute.status, inline: true }, { name: "Reason", value: dispute.reason || "Unavailable", inline: true }, { name: "Entitlement", value: entitlementAction }, { name: "Staff review", value: `${siteUrl()}/staff/store/orders/?order=${encodeURIComponent(order.orderNumber || order.id)}` }] });
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Netlify.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !webhookSecret) return json({ error: "Webhook is not configured" }, 503);
  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return json({ error: "Invalid Stripe signature" }, 400);
  }
  if (!await claimEvent(event)) return json({ received: true, duplicate: true });
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": await fulfillCheckout(event.data.object as Stripe.Checkout.Session); break;
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.order_id) await db.update(orders).set({ paymentStatus: "failed", fulfillmentStatus: "pending", updatedAt: new Date() }).where(eq(orders.id, session.metadata.order_id));
        break;
      }
      case "payment_intent.succeeded": await handlePaymentIntent(event.data.object as Stripe.PaymentIntent, true); break;
      case "payment_intent.payment_failed": await handlePaymentIntent(event.data.object as Stripe.PaymentIntent, false); break;
      case "refund.created":
      case "refund.updated": await handleRefund(event.data.object as Stripe.Refund); break;
      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed": await handleDispute(event.data.object as Stripe.Dispute, event.type, (event.data.previous_attributes as { status?: string } | undefined)?.status); break;
      default: break;
    }
    await db.update(processedStripeEvents).set({ status: "processed", processedAt: new Date(), errorMessage: null }).where(eq(processedStripeEvents.stripeEventId, event.id));
    return json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Webhook processing failed";
    await db.update(processedStripeEvents).set({ status: "failed", errorMessage: message }).where(eq(processedStripeEvents.stripeEventId, event.id));
    await sendDiscordWebhook("DISCORD_STRIPE_SECURITY_WEBHOOK_URL", { title: "Stripe Webhook Processing Failed", severity: "critical", fields: [{ name: "Event ID", value: event.id }, { name: "Event type", value: event.type }, { name: "Failure", value: message }] });
    return json({ error: "Webhook processing failed" }, 500);
  }
};


