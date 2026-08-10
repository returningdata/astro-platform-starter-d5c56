import type { Config } from "@netlify/functions";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { getStore } from "@netlify/blobs";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { productVersions, products } from "../../db/schema.js";
import { json, rateLimit, requirePermission, validateMutation } from "./_lib/security.mjs";
import { writeAudit } from "./_lib/store.mjs";

const BOOTSTRAP_FILES: Record<string, string> = {
  "dm-relay": "DM-RELAY-Buyer-Ready.zip",
  manager: "Manager-Buyer-Ready.zip",
  scarlett: "Scarlett-Buyer-Ready-Full.zip",
  "leo-toolkit": "LEO-TOOLKIT-Buyer-Ready.zip",
  "iaa-bot": "IAA-BOT-Buyer-Ready.zip",
};

async function saveArtifact(productId: number, slug: string, filename: string, version: string, data: Blob | ArrayBuffer) {
  const safeName = basename(filename).replace(/[^a-zA-Z0-9._-]/g, "-");
  const key = `products/${slug}/${safeName}`;
  await getStore({ name: "store-artifacts", consistency: "strong" }).set(key, data);
  await db.update(products).set({ artifactKey: key, currentVersion: version, updatedAt: new Date() }).where(eq(products.id, productId));
  await db.update(productVersions).set({ isCurrent: false, updatedAt: new Date() }).where(eq(productVersions.productId, productId));
  await db.insert(productVersions).values({ productId, version, releaseDate: new Date(), isCurrent: true, artifactKey: key, downloadEnabled: true }).onConflictDoUpdate({ target: [productVersions.productId, productVersions.version], set: { isCurrent: true, artifactKey: key, downloadEnabled: true, updatedAt: new Date() } });
  return key;
}

export default async (req: Request) => {
  try {
    const session = await requirePermission(req, "store.products.manage");
    if (req.method === "GET") {
      const items = await db.select({ id: products.id, slug: products.slug, name: products.name, version: products.currentVersion, artifactKey: products.artifactKey }).from(products).where(eq(products.commerceEnabled, true));
      return json({ items: items.map((item) => ({ ...item, configured: Boolean(item.artifactKey) })) });
    }
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!await rateLimit(req, 10, 60_000)) return json({ error: "Too many artifact changes. Try again shortly." }, 429);
    if (!validateMutation(req, session)) return json({ error: "Invalid request verification" }, 403);
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "bootstrap") {
      const uploaded: string[] = [];
      for (const [slug, filename] of Object.entries(BOOTSTRAP_FILES)) {
        const [product] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
        if (!product) continue;
        const data = await readFile(resolve(process.cwd(), ".netlify/assets/6a796917dc706944f2e772de", filename));
        await saveArtifact(product.id, slug, filename, "Buyer release", data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
        uploaded.push(slug);
      }
      await writeAudit(session.internalUserId, "product_artifacts_bootstrapped", "product", null, { uploaded });
      return json({ success: true, uploaded });
    }
    const form = await req.formData();
    const slug = String(form.get("productSlug") || "");
    const version = String(form.get("version") || "").trim().slice(0, 80);
    const file = form.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".zip") || file.size > 50 * 1024 * 1024) return json({ error: "Select a ZIP file no larger than 50 MB" }, 400);
    const [product] = await db.select().from(products).where(and(eq(products.slug, slug), eq(products.commerceEnabled, true))).limit(1);
    if (!product || !version) return json({ error: "Valid product and version are required" }, 400);
    const key = await saveArtifact(product.id, slug, file.name, version, file);
    await writeAudit(session.internalUserId, "product_artifact_uploaded", "product", String(product.id), { version, key });
    return json({ success: true, key });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Artifact operation failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Unable to manage product files" }, 500);
  }
};

export const config: Config = { path: "/api/staff/store/artifacts" };

