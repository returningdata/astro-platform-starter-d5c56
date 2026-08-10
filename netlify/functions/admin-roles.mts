import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { json, requireStaff, validateMutation } from "./_lib/security.mjs";

const OWNER_ROLE_ID = Netlify.env.get("KRUIGER_OWNER_ROLE_ID") || "1411715697888989286";
const ALLOWED_PERMISSIONS = new Set([
  "all", "manage_skills", "manage_tools", "manage_bots", "manage_services", "manage_chat",
  "store.analytics.view", "store.products.view", "store.products.manage", "store.orders.view",
  "store.orders.manage", "store.customers.view", "store.setup.manage", "store.sales.view",
  "store.sales.manage", "store.entitlements.manage", "store.logs.view",
]);

interface AdminRole { roleId: string; roleName: string; permissions: string[]; }
const defaults = (): AdminRole[] => [{ roleId: OWNER_ROLE_ID, roleName: "Owner", permissions: ["all"] }];

export default async (req: Request) => {
  try {
    const session = await requireStaff(req);
    if (!session.isOwner) return json({ error: "Only owners can manage staff role mappings" }, 403);
    if (req.method !== "GET" && !validateMutation(req, session)) return json({ error: "Invalid request verification" }, 403);
    const store = getStore({ name: "admin-config", consistency: "strong" });
    const stored = await store.get("admin-roles", { type: "json" }) as AdminRole[] | null;
    const roles = stored?.length ? stored : defaults();

    if (req.method === "GET") return json({ roles });
    if (req.method === "POST") {
      const body = await req.json() as Partial<AdminRole>;
      const roleId = String(body.roleId || "").trim();
      const roleName = String(body.roleName || "").trim().slice(0, 80);
      const permissions = [...new Set(Array.isArray(body.permissions) ? body.permissions.filter((permission): permission is string => typeof permission === "string" && ALLOWED_PERMISSIONS.has(permission)) : [])];
      if (!/^\d{15,22}$/.test(roleId) || !roleName || !permissions.length) return json({ error: "Enter a valid Discord role ID, role name, and at least one approved permission" }, 400);
      const next = [...roles];
      const existing = next.findIndex((role) => role.roleId === roleId);
      if (existing >= 0) next[existing] = { roleId, roleName, permissions }; else next.push({ roleId, roleName, permissions });
      await store.setJSON("admin-roles", next);
      return json({ success: true, roles: next });
    }
    if (req.method === "DELETE") {
      const roleId = new URL(req.url).searchParams.get("roleId") || "";
      if (roleId === OWNER_ROLE_ID) return json({ error: "The configured owner role cannot be deleted" }, 400);
      const next = roles.filter((role) => role.roleId !== roleId);
      await store.setJSON("admin-roles", next);
      return json({ success: true, roles: next });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "Unable to manage staff role mappings" }, 500);
  }
};

export const config: Config = { path: "/api/admin/roles" };
