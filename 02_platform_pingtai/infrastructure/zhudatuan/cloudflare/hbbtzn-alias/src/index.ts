const ROOT_STOREFRONT_HOST = 'hbbtzn.com';
const API_UPSTREAM_ORIGIN = 'https://api.zhudatuan.com';
const ACCOUNTS_UPSTREAM_ORIGIN = 'https://accounts.zhudatuan.com';
const CONSUMER_ACCOUNT_PATH = '/accounts';
const WECHAT_VERIFICATION_FILES = Object.freeze({
  '/MP_verify_5ebC4TM1ep4hKgu3.txt': '5ebC4TM1ep4hKgu3',
} as const);

const UPSTREAM_ORIGINS = Object.freeze({
  [ROOT_STOREFRONT_HOST]: 'https://zhudatuan.com',
} as const);

const CANONICAL_REDIRECT_HOSTS = Object.freeze({
  'accounts.hbbtzn.com': 'accounts.zhudatuan.com',
  'api.hbbtzn.com': 'api.zhudatuan.com',
  'mall.hbbtzn.com': ROOT_STOREFRONT_HOST,
} as const);

const PUBLIC_ORIGINS = Object.freeze({
  'https://accounts.zhudatuan.com': 'https://hbbtzn.com/accounts',
  'https://zhudatuan.com': 'https://hbbtzn.com',
} as const);

const UPSTREAM_REQUEST_ORIGINS = Object.freeze({
  'https://hbbtzn.com': 'https://zhudatuan.com',
} as const);

function rewriteOrigins(value: string, origins: Readonly<Record<string, string>>): string {
  return Object.entries(origins).reduce(
    (current, [source, destination]) => current.replaceAll(source, destination),
    value,
  );
}

function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/');
}

function isConsumerAccountPath(pathname: string): boolean {
  return pathname === CONSUMER_ACCOUNT_PATH || pathname.startsWith(`${CONSUMER_ACCOUNT_PATH}/`);
}

function wechatVerificationResponse(request: Request, incoming: URL): Response | null {
  if (incoming.hostname !== ROOT_STOREFRONT_HOST || (request.method !== 'GET' && request.method !== 'HEAD')) {
    return null;
  }
  const content = WECHAT_VERIFICATION_FILES[
    incoming.pathname as keyof typeof WECHAT_VERIFICATION_FILES
  ];
  if (!content) return null;
  return new Response(request.method === 'HEAD' ? null : content, {
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
      'x-content-type-options': 'nosniff',
    },
  });
}

function consumerAccountUpstreamPath(pathname: string): string {
  const suffix = pathname.slice(CONSUMER_ACCOUNT_PATH.length);
  return suffix || '/';
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

async function publicResponse(request: Request, upstream: Response): Promise<Response> {
  const headers = new Headers(upstream.headers);
  const requestOrigin = request.headers.get('origin');
  const upstreamAllowedOrigin = headers.get('access-control-allow-origin');
  const normalizedRequestOrigin = requestOrigin === null
    ? null
    : rewriteOrigins(requestOrigin, UPSTREAM_REQUEST_ORIGINS);
  if (requestOrigin !== null && upstreamAllowedOrigin === normalizedRequestOrigin) {
    headers.set('access-control-allow-origin', requestOrigin);
  }
  for (const header of ['content-security-policy', 'location', 'refresh']) {
    const value = headers.get(header);
    if (value) headers.set(header, rewriteOrigins(value, PUBLIC_ORIGINS));
  }
  const html = headers.get('content-type')?.toLowerCase().startsWith('text/html') === true;
  const body = html ? publicHtml(request, await upstream.text()) : upstream.body;
  if (html) {
    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.delete('etag');
  }
  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

function publicHtml(request: Request, source: string): string {
  const publicOrigin = new URL(request.url).origin;
  return source
    .replaceAll('https://h5.zhudatuan.com', publicOrigin)
    .replaceAll('https://zhudatuan.com', publicOrigin);
}

const worker = {
  async fetch(request: Request): Promise<Response> {
    const incoming = new URL(request.url);

    const verification = wechatVerificationResponse(request, incoming);
    if (verification) return verification;

    const canonicalHost = CANONICAL_REDIRECT_HOSTS[
      incoming.hostname as keyof typeof CANONICAL_REDIRECT_HOSTS
    ];
    if (canonicalHost) {
      incoming.hostname = canonicalHost;
      incoming.protocol = 'https:';
      return Response.redirect(incoming, request.method === 'GET' || request.method === 'HEAD' ? 308 : 307);
    }

    const upstreamOrigin = UPSTREAM_ORIGINS[incoming.hostname as keyof typeof UPSTREAM_ORIGINS];
    if (!upstreamOrigin) return new Response('Not Found', { status: 404 });

    if (incoming.hostname === ROOT_STOREFRONT_HOST && incoming.pathname === CONSUMER_ACCOUNT_PATH) {
      incoming.pathname = `${CONSUMER_ACCOUNT_PATH}/`;
      return Response.redirect(incoming, 308);
    }

    if (incoming.hostname === ROOT_STOREFRONT_HOST && isConsumerAccountPath(incoming.pathname)) {
      const target = new URL(`${consumerAccountUpstreamPath(incoming.pathname)}${incoming.search}`, ACCOUNTS_UPSTREAM_ORIGIN);
      return await publicResponse(request, await fetch(upstreamRequest(request, target), { redirect: 'manual' }));
    }

    const path = storefrontPath(request, incoming);
    const target = new URL(`${path}${incoming.search}`, isApiPath(path) ? API_UPSTREAM_ORIGIN : upstreamOrigin);
    return await publicResponse(request, await fetch(upstreamRequest(request, target), { redirect: 'manual' }));
  },
};

export default worker;
