import type { Config } from "@netlify/functions";
import { and, gt, lte, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { sales } from "../../db/schema.js";
import { getCommerceProducts } from "./_lib/store.mjs";
import { json, rateLimit } from "./_lib/security.mjs";

export default async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!await rateLimit(req, 60)) return json({ error: "Too many requests" }, 429);
  try {
    const now = new Date();
    const [items, activeSales] = await Promise.all([
      getCommerceProducts(false),
      db.select().from(sales).where(and(eq(sales.enabled, true), lte(sales.startsAt, now), gt(sales.endsAt, now))),
    ]);
    const publicItems = items.map((item) => {
      const sale = activeSales.find((candidate) => candidate.allProducts || candidate.productIds.includes(item.id));
      const amount = item.price?.amountCents || 0;
      const saleAmount = sale?.stripeCouponId
        ? Math.max(0, sale.discountType === "percent" ? Math.round(amount * (1 - sale.discountValue / 100)) : amount - sale.discountValue)
        : null;
      return {
        id: item.id,
        slug: item.slug,
        name: item.name,
        description: item.description,
        fullDescription: item.fullDescription,
        category: item.category,
        status: item.status,
        availabilityMessage: item.availabilityMessage,
        productType: item.productType,
        documentationUrl: item.documentationUrl,
        currentVersion: item.currentVersion,
        featured: item.featured,
        setupEligible: item.setupEligible,
        requirements: item.requirements,
        externalIntegrations: item.externalIntegrations,
        includedProductSlugs: item.includedProductSlugs,
        badges: { oneTimePurchase: item.oneTimePurchase, selfHosted: item.selfHosted, sourceIncluded: item.sourceIncluded, noMonthlyLicenseFee: item.noMonthlyLicenseFee },
        price: item.price ? { amountCents: amount, currency: item.price.currency, isStartingAt: item.price.isStartingAt } : null,
        sale: sale && saleAmount !== null ? { name: sale.name, badge: sale.publicBadge, banner: sale.banner, endsAt: sale.endsAt, amountCents: saleAmount, savingsCents: amount - saleAmount } : null,
        purchasable: item.status === "active" && Boolean(item.price?.stripePriceId),
      };
    });
    return json({ items: publicItems.filter((item) => item.productType !== "custom"), quoteItems: publicItems.filter((item) => item.productType === "custom") });
  } catch (error) {
    console.error("Store catalog failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Store catalogue is temporarily unavailable" }, 503);
  }
};

export const config: Config = { path: "/api/store/catalog" };

