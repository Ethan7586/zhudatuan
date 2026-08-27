import * as z from 'zod/mini';

export const DEEP_LINK_ROUTES = Object.freeze(['productdetail', 'orderdetail'] as const);
export type DeepLinkRoute = (typeof DEEP_LINK_ROUTES)[number];

export const DeepLinkSchema = z.strictObject({
  route: z.enum(DEEP_LINK_ROUTES),
  id: z.string().check(z.regex(/^[A-Za-z0-9:%._-]{1,255}$/)),
});
export type DeepLink = z.infer<typeof DeepLinkSchema>;

export function parseDeepLink(value: string): DeepLink {
  const match = /^\/page\/([a-z]+)\/index\?id=([A-Za-z0-9:%._-]{1,255})$/.exec(value);
  if (!match) throw new Error('DEEPLINK_INVALID');
  return validDeepLink({ route: match[1], id: match[2] });
}

export function miniappDeepLink(value: DeepLink): string {
  const link = validDeepLink(value);
  return `/page/${link.route}/index?id=${encodeURIComponent(decodeURIComponent(link.id))}`;
}

function validDeepLink(value: unknown): DeepLink {
  const parsed = DeepLinkSchema.safeParse(value);
  if (!parsed.success) throw new Error('DEEPLINK_INVALID');
  return parsed.data;
}
