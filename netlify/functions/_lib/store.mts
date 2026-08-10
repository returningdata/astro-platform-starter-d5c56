import Stripe from "stripe";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { auditLogs, entitlements, productPrices, products, users } from "../../../db/schema.js";
import type { PortalSession } from "./security.mjs";

export const SOFTWARE_SLUGS = ["dm-relay", "manager", "scarlett", "leo-toolkit", "iaa-bot"] as const;
export const BUNDLE_SLUG = "complete-bot-bundle";

export const PRICE_ENV_BY_SLUG: Record<string, string> = {
  "dm-relay": "STRIPE_PRICE_DM_RELAY",
  manager: "STRIPE_PRICE_MANAGER",
  scarlett: "STRIPE_PRICE_SCARLETT",
  "leo-toolkit": "STRIPE_PRICE_LEO_TOOLKIT",
  "iaa-bot": "STRIPE_PRICE_IAA_BOT",
  "complete-bot-bundle": "STRIPE_PRICE_COMPLETE_BUNDLE",
  "basic-bot-installation": "STRIPE_PRICE_BASIC_INSTALL",
  "discord-configuration": "STRIPE_PRICE_DISCORD_CONFIG",
  "mysql-setup": "STRIPE_PRICE_MYSQL_SETUP",
  "fivem-integration-setup": "STRIPE_PRICE_FIVEM_SETUP",
  "leo-sheets-backend-setup": "STRIPE_PRICE_LEO_SETUP",
  "iaa-website-oauth-backend-setup": "STRIPE_PRICE_IAA_SETUP",
  "full-setup-dm-relay": "STRIPE_PRICE_FULL_DM_RELAY",
  "full-setup-manager": "STRIPE_PRICE_FULL_MANAGER",
  "full-setup-scarlett": "STRIPE_PRICE_FULL_SCARLETT",
  "full-setup-leo-toolkit": "STRIPE_PRICE_FULL_LEO",
  "full-setup-iaa-bot": "STRIPE_PRICE_FULL_IAA",
  "full-deployment-complete-bundle": "STRIPE_PRICE_FULL_BUNDLE",
};

export const TRUSTED_PRICE_CENTS: Record<string, number> = {
  "dm-relay": 1499, manager: 2499, scarlett: 3499, "leo-toolkit": 3999, "iaa-bot": 4999,
  "complete-bot-bundle": 11999, "basic-bot-installation": 1499, "discord-configuration": 999,
  "mysql-setup": 999, "fivem-integration-setup": 1999, "leo-sheets-backend-setup": 2999,
  "iaa-website-oauth-backend-setup": 4999, "full-setup-dm-relay": 7499, "full-setup-manager": 9999,
  "full-setup-scarlett": 11999, "full-setup-leo-toolkit": 14999, "full-setup-iaa-bot": 19999,
  "full-deployment-complete-bundle": 34999,
};

export function getStripe() {
  const secret = Netlify.env.get("STRIPE_SECRET_KEY");
  if (!secret) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(secret, { maxNetworkRetries: 2 });
}

export function siteUrl() {
  return (Netlify.env.get("SITE_URL") || Netlify.env.get("URL") || "http://localhost:8889").replace(/\/$/, "");
}

export function priceEnvironmentValue(slug: string) {
  const key = PRICE_ENV_BY_SLUG[slug];
  return key ? Netlify.env.get(key) || null : null;
}

export function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export async function getCommerceProducts(includeHidden = false) {
  const rows = await db.select({ product: products, price: productPrices }).from(products).leftJoin(productPrices, and(eq(productPrices.productId, products.id), eq(productPrices.active, true))).where(includeHidden ? eq(products.commerceEnabled, true) : and(eq(products.commerceEnabled, true), eq(products.published, true), or(eq(products.status, "active"), eq(products.status, "paused"), eq(products.status, "coming_soon")))).orderBy(products.sortOrder, products.name);
  return rows.map(({ product, price }) => ({
    ...product,
    price: price ? { ...price, stripePriceId: priceEnvironmentValue(product.slug) || price.stripePriceId } : null,
  }));
}

export async function getPurchasableItems(slugs: string[]) {
  const unique = [...new Set(slugs)];
  if (!unique.length) return [];
  const rows = await db.select({ product: products, price: productPrices }).from(products).innerJoin(productPrices, and(eq(productPrices.productId, products.id), eq(productPrices.active, true))).where(and(inArray(products.slug, unique), eq(products.commerceEnabled, true), eq(products.status, "active"), eq(products.published, true)));
  return rows.map(({ product, price }) => ({ product, price: { ...price, stripePriceId: priceEnvironmentValue(product.slug) || price.stripePriceId } }));
}

export async function getAccount(session: PortalSession) {
  const [account] = await db.select().from(users).where(eq(users.id, session.internalUserId)).limit(1);
  if (!account || account.accountStatus !== "active") throw new Error("Customer account is not active");
  return account;
}

export async function ownedProductSlugs(userId: number) {
  const rows = await db.select({ slug: products.slug }).from(entitlements).innerJoin(products, eq(entitlements.productId, products.id)).where(and(eq(entitlements.userId, userId), eq(entitlements.status, "active")));
  return rows.map((row) => row.slug);
}

export async function writeAudit(actorId: number | null, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown> = {}, ipHash?: string | null) {
  await db.insert(auditLogs).values({ actorId, action, entityType, entityId, metadata, ipHash: ipHash || null });
}

export function hasStaffPermission(session: PortalSession, permission: string) {
  return session.isOwner || session.permissions.includes("all") || session.permissions.includes(permission);
}

export async function activePriceForProduct(productId: number) {
  const [price] = await db.select().from(productPrices).where(and(eq(productPrices.productId, productId), eq(productPrices.active, true), isNull(productPrices.retiredAt))).orderBy(desc(productPrices.createdAt)).limit(1);
  return price || null;
}

