import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import { setupIntakeSubmissions, setupServices } from "../../db/schema.js";
import { json, rateLimit, requireSession, sanitizeText, validateMutation } from "./_lib/security.mjs";
import { writeAudit } from "./_lib/store.mjs";

const intake = z.object({ setupServiceId: z.string().uuid(), discordUsername: z.string().max(100), discordUserId: z.string().regex(/^\d{15,22}$/), guildId: z.string().regex(/^\d{15,22}$/).optional().or(z.literal("")), hostingProvider: z.string().max(120).optional(), hostingPanelUrl: z.string().url().optional().or(z.literal("")), botInstalled: z.boolean().optional(), databaseProvider: z.string().max(120).optional(), fivemServerIp: z.string().max(255).optional(), fivemPort: z.string().max(10).optional(), cfxJoinCode: z.string().max(80).optional(), googleSheetUrl: z.string().url().optional().or(z.literal("")), googleCloudStatus: z.string().max(120).optional(), backendUrl: z.string().url().optional().or(z.literal("")), websiteUrl: z.string().url().optional().or(z.literal("")), oauthReadiness: z.string().max(120).optional(), additionalNotes: z.string().max(4000).optional() });

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!await rateLimit(req, 8, 60_000)) return json({ error: "Too many setup intake attempts" }, 429);
  try {
    const session = await requireSession(req);
    if (!validateMutation(req, session)) return json({ error: "Invalid request verification" }, 403);
    const parsed = intake.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "Please check the setup intake fields" }, 400);
    const [service] = await db.select().from(setupServices).where(eq(setupServices.id, parsed.data.setupServiceId)).limit(1);
    if (!service || service.userId !== session.internalUserId) return json({ error: "Setup service not found" }, 404);
    const safeData = Object.fromEntries(Object.entries(parsed.data).filter(([key]) => key !== "setupServiceId").map(([key, value]) => [key, typeof value === "string" ? sanitizeText(value, key === "additionalNotes" ? 4000 : 500) : value]));
    await db.insert(setupIntakeSubmissions).values({ setupServiceId: service.id, userId: session.internalUserId, data: safeData });
    await db.update(setupServices).set({ status: "ready_for_setup", updatedAt: new Date() }).where(eq(setupServices.id, service.id));
    await writeAudit(session.internalUserId, "setup_intake_submitted", "setup_service", service.id, {});
    return json({ success: true, status: "ready_for_setup" });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "Unable to submit setup information" }, 500);
  }
};

export const config: Config = { path: "/api/customer/setup-intake" };

