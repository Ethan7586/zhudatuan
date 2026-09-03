const UPSTREAM_ORIGINS = Object.freeze({
  'accounts.hbbtzn.com': 'https://accounts.zhudatuan.com',
  'api.hbbtzn.com': 'https://api.zhudatuan.com',
  'mall.hbbtzn.com': 'https://zhudatuan.com',
} as const);

const PUBLIC_ORIGINS = Object.freeze({
  'https://accounts.zhudatuan.com': 'https://accounts.hbbtzn.com',
  'https://api.zhudatuan.com': 'https://api.hbbtzn.com',
  'https://zhudatuan.com': 'https://mall.hbbtzn.com',
} as const);

function rewritePublicOrigins(value: string): string {
  return Object.entries(PUBLIC_ORIGINS).reduce(
    (current, [upstream, publicOrigin]) => current.replaceAll(upstream, publicOrigin),
    value,
  );
}

export default {
  async fetch(request: Request): Promise<Response> {
    const incoming = new URL(request.url);
    const upstreamOrigin = UPSTREAM_ORIGINS[incoming.hostname as keyof typeof UPSTREAM_ORIGINS];
    if (!upstreamOrigin) return new Response('Not Found', { status: 404 });

    const target = new URL(`${incoming.pathname}${incoming.search}`, upstreamOrigin);
    const upstream = await fetch(new Request(target, request), { redirect: 'manual' });
    const response = new Response(upstream.body, upstream);
    for (const header of ['content-security-policy', 'location', 'refresh']) {
      const value = response.headers.get(header);
      if (value) response.headers.set(header, rewritePublicOrigins(value));
    }
    return response;
  },
};
