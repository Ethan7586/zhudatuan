const ROOT_STOREFRONT_HOST = 'hbbtzn.com';
const LEGACY_STOREFRONT_HOST = 'mall.hbbtzn.com';

const UPSTREAM_ORIGINS = Object.freeze({
  [ROOT_STOREFRONT_HOST]: 'https://zhudatuan.com',
  'accounts.hbbtzn.com': 'https://accounts.zhudatuan.com',
  'api.hbbtzn.com': 'https://api.zhudatuan.com',
} as const);

const PUBLIC_ORIGINS = Object.freeze({
  'https://accounts.zhudatuan.com': 'https://accounts.hbbtzn.com',
  'https://api.zhudatuan.com': 'https://api.hbbtzn.com',
  'https://zhudatuan.com': 'https://hbbtzn.com',
  'https://mall.hbbtzn.com': 'https://hbbtzn.com',
} as const);

const UPSTREAM_REQUEST_ORIGINS = Object.freeze({
  'https://accounts.hbbtzn.com': 'https://accounts.zhudatuan.com',
  'https://hbbtzn.com': 'https://zhudatuan.com',
  'https://mall.hbbtzn.com': 'https://zhudatuan.com',
} as const);

function rewriteOrigins(value: string, origins: Readonly<Record<string, string>>): string {
  return Object.entries(origins).reduce(
    (current, [source, destination]) => current.replaceAll(source, destination),
    value,
  );
}

function storefrontPath(request: Request, incoming: URL): string {
  if (incoming.hostname !== ROOT_STOREFRONT_HOST || (request.method !== 'GET' && request.method !== 'HEAD')) {
    return incoming.pathname;
  }
  if (incoming.pathname === '/api' || incoming.pathname.startsWith('/api/')) return incoming.pathname;
  if (incoming.pathname.startsWith('/assets/') || incoming.pathname.startsWith('/_next/') || /\.[a-z0-9]+$/i.test(incoming.pathname)) {
    return incoming.pathname;
  }
  return '/h5';
}

function upstreamRequest(request: Request, target: URL): Request {
  const headers = new Headers(request.headers);
  for (const header of ['origin', 'referer']) {
    const value = headers.get(header);
    if (value) headers.set(header, rewriteOrigins(value, UPSTREAM_REQUEST_ORIGINS));
  }
  return new Request(target, {
    method: request.method,
    headers,
    redirect: 'manual',
    ...(request.method === 'GET' || request.method === 'HEAD' ? {} : { body: request.body }),
  });
}

function publicResponse(upstream: Response): Response {
  const headers = new Headers(upstream.headers);
  for (const header of ['access-control-allow-origin', 'content-security-policy', 'location', 'refresh']) {
    const value = headers.get(header);
    if (value) headers.set(header, rewriteOrigins(value, PUBLIC_ORIGINS));
  }
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

const worker = {
  async fetch(request: Request): Promise<Response> {
    const incoming = new URL(request.url);

    if (incoming.hostname === LEGACY_STOREFRONT_HOST) {
      incoming.hostname = ROOT_STOREFRONT_HOST;
      incoming.protocol = 'https:';
      return Response.redirect(incoming, request.method === 'GET' || request.method === 'HEAD' ? 308 : 307);
    }

    const upstreamOrigin = UPSTREAM_ORIGINS[incoming.hostname as keyof typeof UPSTREAM_ORIGINS];
    if (!upstreamOrigin) return new Response('Not Found', { status: 404 });

    const target = new URL(`${storefrontPath(request, incoming)}${incoming.search}`, upstreamOrigin);
    return publicResponse(await fetch(upstreamRequest(request, target), { redirect: 'manual' }));
  },
};

export default worker;
