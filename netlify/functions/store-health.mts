import type { Config } from "@netlify/functions";
import { desc, eq } from "drizzle-orm";
import { getStore } from "@netlify/blobs";
import { db } from "../../db/index.js";
import { processedStripeEvents, productPrices, products } from "../../db/schema.js";
import { getStripe, PRICE_ENV_BY_SLUG } from "./_lib/store.mjs";
import { json, requireStaff } from "./_lib/security.mjs";

const state = (configured: boolean, healthy = configured) => configured ? (healthy ? "Healthy" : "Error") : "Missing";

export default async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  try {
    await requireStaff(req);
    let databaseHealthy = false; let productCount = 0; let latestSuccess = null; let latestFailure = null;
    try { productCount = (await db.select().from(products).where(eq(products.commerceEnabled, true))).length; databaseHealthy = true; [latestSuccess] = await db.select().from(processedStripeEvents).where(eq(processedStripeEvents.status, "processed")).orderBy(desc(processedStripeEvents.processedAt)).limit(1); [latestFailure] = await db.select().from(processedStripeEvents).where(eq(processedStripeEvents.status, "failed")).orderBy(desc(processedStripeEvents.createdAt)).limit(1); } catch {}
    let stripeReachable = false; if (Netlify.env.get("STRIPE_SECRET_KEY")) { try { await getStripe().balance.retrieve(); stripeReachable = true; } catch {} }
    const activePrices = databaseHealthy ? await db.select({ slug: products.slug, stripePriceId: productPrices.stripePriceId }).from(productPrices).innerJoin(products, eq(productPrices.productId, products.id)).where(eq(productPrices.active, true)) : [];
    const priceChecks = Object.entries(PRICE_ENV_BY_SLUG).map(([slug, variable]) => ({ slug, variable, status: state(Boolean(Netlify.env.get(variable) || activePrices.find((price) => price.slug === slug)?.stripePriceId)) }));
    let storageHealthy = false; try { await getStore({ name: "store-artifacts", consistency: "strong" }).list({ directories: true, prefix: "products/" }); storageHealthy = true; } catch {}
    const oauthClient = Netlify.env.get("DISCORD_OAUTH_CLIENT_ID") || Netlify.env.get("DISCORD_CLIENT_ID"); const oauthSecret = Netlify.env.get("DISCORD_OAUTH_CLIENT_SECRET") || Netlify.env.get("DISCORD_CLIENT_SECRET"); const redirect = Netlify.env.get("DISCORD_OAUTH_REDIRECT_URI") || Netlify.env.get("DISCORD_REDIRECT_URI") || "https://kruigerlabs.xyz/api/auth/discord/callback";
    return json({ checks: { databaseConfigured: state(Boolean(Netlify.env.get("NETLIFY_DATABASE_URL") || Netlify.env.get("DATABASE_URL"))), databaseReachable: state(true, databaseHealthy), stripeSecret: state(Boolean(Netlify.env.get("STRIPE_SECRET_KEY"))), stripeApi: state(Boolean(Netlify.env.get("STRIPE_SECRET_KEY")), stripeReachable), stripeWebhookSecret: state(Boolean(Netlify.env.get("STRIPE_WEBHOOK_SECRET"))), paymentWebhook: state(Boolean(Netlify.env.get("DISCORD_PAYMENT_LOG_WEBHOOK_URL"))), securityWebhook: state(Boolean(Netlify.env.get("DISCORD_STRIPE_SECURITY_WEBHOOK_URL"))), auditWebhook: state(Boolean(Netlify.env.get("DISCORD_STORE_AUDIT_WEBHOOK_URL"))), discordOAuth: state(Boolean(oauthClient && oauthSecret)), privateStorage: state(true, storageHealthy) }, oauthRedirectUrl: redirect, priceChecks, productCount, latestSuccessfulStripeWebhook: latestSuccess ? { eventType: latestSuccess.eventType, processedAt: latestSuccess.processedAt } : null, latestFailedStripeWebhook: latestFailure ? { eventType: latestFailure.eventType, createdAt: latestFailure.createdAt, error: latestFailure.errorMessage } : null });
  } catch (error) { if (error instanceof Response) return error; return json({ error: "Unable to run store health checks" }, 500); }
};

export const config: Config = { path: "/api/staff/store-health" };
