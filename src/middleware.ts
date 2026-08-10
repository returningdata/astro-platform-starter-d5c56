import { defineMiddleware } from 'astro:middleware';
import { getSession } from '../netlify/functions/_lib/security.mjs';

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  if (!path.startsWith('/staff/store/')) return next();

  const session = await getSession(context.request);
  if (!session?.isAdmin) {
    return context.redirect(`/api/auth/discord?action=login&returnTo=${encodeURIComponent(path)}`, 302);
  }
  if (path.startsWith('/staff/store/setup-guide/') && !session.isOwner) {
    return context.redirect('/staff/store/?error=owner_required', 302);
  }
  return next();
});
