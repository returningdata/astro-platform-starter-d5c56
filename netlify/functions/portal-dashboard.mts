import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { linkedDiscordServers, productLicences, products, supportTickets, users } from "../../db/schema.js";
import { json, requireSession } from "./_lib/security.mjs";

export default async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  try {
    const session = await requireSession(req);
    let [user] = await db.select().from(users).where(eq(users.discordId, session.userId)).limit(1);
    if (!user) {
      [user] = await db.insert(users).values({ discordId: session.userId, username: session.username, displayName: session.displayName, avatarUrl: session.avatar, isStaff: session.isAdmin }).returning();
    }
    const licences = await db.select({ id: productLicences.id, reference: productLicences.licenceReference, status: productLicences.status, expiresAt: productLicences.expiresAt, productName: products.name, productSlug: products.slug }).from(productLicences).leftJoin(products, eq(productLicences.productId, products.id)).where(eq(productLicences.userId, user.id));
    const servers = await db.select().from(linkedDiscordServers).where(eq(linkedDiscordServers.userId, user.id));
    const tickets = await db.select().from(supportTickets).where(eq(supportTickets.userId, user.id));
    return json({ profile: { displayName: user.displayName, username: user.username, avatar: user.avatarUrl, isCustomer: user.isCustomer, isStaff: user.isStaff }, licences, servers, tickets, csrfToken: session.csrfToken });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "Unable to load customer dashboard" }, 500);
  }
};

export const config: Config = { path: "/api/customer/dashboard" };
