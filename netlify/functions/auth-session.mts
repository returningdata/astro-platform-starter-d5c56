import type { Context, Config } from "@netlify/functions";
import { json, getSession } from "./_lib/security.mjs";

export default async (req: Request, _context: Context) => {
  const session = await getSession(req);
  if (!session) return json({ authenticated: false });
  return json({
    authenticated: true,
    user: {
      id: session.userId,
      internalUserId: session.internalUserId,
      username: session.username,
      displayName: session.displayName,
      avatar: session.avatar,
      roles: session.roles,
      permissions: session.permissions,
      isAdmin: session.isAdmin,
      isOwner: session.isOwner,
      isInGuild: session.isInGuild,
    },
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt,
  });
};

export const config: Config = { path: "/api/auth/session" };
