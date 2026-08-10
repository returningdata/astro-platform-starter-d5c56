import type { Config } from "@netlify/functions";
import { z } from "zod";
import { db } from "../../db/index.js";
import { documentationFeedback } from "../../db/schema.js";
import { getSession, json, rateLimit, sanitizeText, validateMutation } from "./_lib/security.mjs";

const feedbackSchema = z.object({
  articleSlug: z.string().min(1).max(180),
  helpful: z.boolean(),
  comment: z.string().max(1200).optional(),
});

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!await rateLimit(req, 20)) return json({ error: "Too many requests" }, 429);
  const session = await getSession(req);
  if (!validateMutation(req)) return json({ error: "Invalid request origin" }, 403);
  const parsed = feedbackSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid feedback" }, 400);
  await db.insert(documentationFeedback).values({
    articleSlug: sanitizeText(parsed.data.articleSlug, 180),
    helpful: parsed.data.helpful,
    comment: sanitizeText(parsed.data.comment, 1200) || null,
    userId: null,
  });
  return json({ ok: true }, 201);
};

export const config: Config = { path: "/api/docs/feedback" };

