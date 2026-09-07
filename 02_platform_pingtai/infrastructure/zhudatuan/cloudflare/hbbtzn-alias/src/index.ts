// SFL-D01：L1 通过 L0 物理源站复用同源制品的历史边缘兼容层。
// 本文件只能转发和翻译旧入口，不能成为节点身份、权限、数据范围或业务事实的来源。
const ROOT_STOREFRONT_HOST = 'hbbtzn.com';
const API_UPSTREAM_ORIGIN = 'https://api.zhudatuan.com';
const ACCOUNTS_UPSTREAM_ORIGIN = 'https://accounts.zhudatuan.com';
const CONSOLE_UPSTREAM_ORIGIN = 'https://console.zhudatuan.com';
const HONGTAI_CONSOLE_HOST = 'console.hbbtzn.com';
const HONGTAI_CONSOLE_ORIGIN = `https://${HONGTAI_CONSOLE_HOST}`;
const HONGTAI_API_HOST = 'api.hbbtzn.com';
const HONGTAI_NODE_ID = 'node:hbbtzn:l1';
const HONGTAI_ACCOUNTS_ORIGIN = 'https://accounts.hbbtzn.com';
const HONGTAI_CONSOLE_SCOPE = '/scopes/mall/mall%3Ad1708f04df2dd8a61736852c4900fb43/cockpit';
const HONGTAI_CONTROL_ASSET_PREFIX = '/__hbbtzn-v1/assets/';
const CONSUMER_ACCOUNT_PATH = '/accounts';
const HONGTAI_CONSUMER_APPLICATION = 'zdt-l1-verify';
const IDENTITY_ENTRY_HOST_HEADER = 'x-zdt-identity-entry-host';
const WECHAT_VERIFICATION_FILES = Object.freeze({
  '/MP_verify_5ebC4TM1ep4hKgu3.txt': '5ebC4TM1ep4hKgu3',
} as const);

const UPSTREAM_ORIGINS = Object.freeze({
  [ROOT_STOREFRONT_HOST]: 'https://zhudatuan.com',
  'accounts.hbbtzn.com': ACCOUNTS_UPSTREAM_ORIGIN,
  'api.hbbtzn.com': API_UPSTREAM_ORIGIN,
  [HONGTAI_CONSOLE_HOST]: CONSOLE_UPSTREAM_ORIGIN,
} as const);

const CANONICAL_REDIRECT_HOSTS = Object.freeze({
  'hbbtzn.zhudatuan.com': ROOT_STOREFRONT_HOST,
  'console-hbbtzn.zhudatuan.com': 'console.hbbtzn.com',
  'mall.hbbtzn.com': ROOT_STOREFRONT_HOST,
} as const);

const STOREFRONT_PUBLIC_ORIGINS = Object.freeze({
  'https://accounts.zhudatuan.com': 'https://hbbtzn.com/accounts',
  'https://zhudatuan.com': 'https://hbbtzn.com',
} as const);

const CONTROL_PUBLIC_ORIGINS = Object.freeze({
  'https://accounts.zhudatuan.com': 'https://accounts.hbbtzn.com',
  'https://api.zhudatuan.com': 'https://api.hbbtzn.com',
  'https://console.zhudatuan.com': HONGTAI_CONSOLE_ORIGIN,
  'https://zhudatuan.com': 'https://hbbtzn.com',
} as const);

const UPSTREAM_REQUEST_ORIGINS = Object.freeze({
  'https://hbbtzn.com': 'https://zhudatuan.com',
  'https://accounts.hbbtzn.com': 'https://accounts.zhudatuan.com',
  'https://api.hbbtzn.com': 'https://api.zhudatuan.com',
  [HONGTAI_CONSOLE_ORIGIN]: CONSOLE_UPSTREAM_ORIGIN,
} as const);

const HONGTAI_WEB_BUSINESS_PATHS = Object.freeze([
  '/api/v1/members/me',
  '/api/v1/organizations/layers',
  '/api/v1/reports/dashboard',
  '/api/v1/catalog/listings',
  '/api/v1/catalog/public/products',
  '/api/v1/pricing/offers',
  '/api/v1/inventory/availability',
  '/api/v1/carts/current',
  '/api/v1/benefits/accounts',
  '/api/v1/benefits/ledgers',
  '/api/v1/orders',
] as const);

type HongtaiNodeSurface = 'catalog-operator' | 'web-business';

interface HongtaiNodeRoute {
  readonly nodeId: typeof HONGTAI_NODE_ID;
  readonly surface: HongtaiNodeSurface;
}

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

function belongsToPathFamily(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

function hongtaiNodeRoute(request: Request, incoming: URL, pathname: string): HongtaiNodeRoute | undefined {
  if (incoming.hostname === HONGTAI_CONSOLE_HOST) {
    return { nodeId: HONGTAI_NODE_ID, surface: 'catalog-operator' };
  }
  const routedMethod = request.method === 'OPTIONS'
    ? request.headers.get('access-control-request-method')?.toUpperCase() ?? request.method
    : request.method;
  const ordersRead = pathname !== '/api/v1/orders' || routedMethod === 'GET';
  const webBusiness = ordersRead
    && HONGTAI_WEB_BUSINESS_PATHS.some((root) => belongsToPathFamily(pathname, root));
  const catalogListingRead = pathname === '/api/v1/catalog/listings'
    && (routedMethod === 'GET' || routedMethod === 'HEAD');
  const publicCatalog = belongsToPathFamily(pathname, '/api/v1/catalog/public/products');
  const catalogOperator = incoming.hostname === HONGTAI_API_HOST
    && belongsToPathFamily(pathname, '/api/v1/catalog')
    && !catalogListingRead
    && !publicCatalog;
  if (catalogOperator) return { nodeId: HONGTAI_NODE_ID, surface: 'catalog-operator' };
  if (((incoming.hostname === ROOT_STOREFRONT_HOST || incoming.hostname === HONGTAI_API_HOST)
      && webBusiness)
    || (incoming.hostname === ROOT_STOREFRONT_HOST
      && belongsToPathFamily(pathname, '/catalog-media'))) {
    return { nodeId: HONGTAI_NODE_ID, surface: 'web-business' };
  }
  return undefined;
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

function controlAssetUpstreamPath(incoming: URL): string | undefined {
  const controlHost = incoming.hostname === HONGTAI_CONSOLE_HOST || incoming.hostname === 'accounts.hbbtzn.com';
  if (!controlHost || !incoming.pathname.startsWith(HONGTAI_CONTROL_ASSET_PREFIX)) return undefined;
  return `/assets/${incoming.pathname.slice(HONGTAI_CONTROL_ASSET_PREFIX.length)}`;
}

function upstreamRequest(request: Request, target: URL, nodeRoute?: HongtaiNodeRoute): Request {
  const headers = new Headers(request.headers);
  const incoming = new URL(request.url);
  const controlDocument = (incoming.hostname === HONGTAI_CONSOLE_HOST || incoming.hostname === 'accounts.hbbtzn.com')
    && headers.get('accept')?.includes('text/html') === true;
  if (controlDocument) {
    headers.delete('if-modified-since');
    headers.delete('if-none-match');
  }
  headers.delete('x-sfl-node-id');
  headers.delete('x-sfl-node-surface');
  if (nodeRoute) {
    headers.set('x-sfl-node-id', nodeRoute.nodeId);
    headers.set('x-sfl-node-surface', nodeRoute.surface);
  } else {
    for (const header of ['origin', 'referer']) {
      const value = headers.get(header);
      if (value) headers.set(header, rewriteOrigins(value, UPSTREAM_REQUEST_ORIGINS));
    }
  }
  if (isApiPath(target.pathname)) {
    headers.set(
      IDENTITY_ENTRY_HOST_HEADER,
      incoming.hostname === HONGTAI_CONSOLE_HOST ? HONGTAI_API_HOST : incoming.hostname,
    );
  } else {
    headers.delete(IDENTITY_ENTRY_HOST_HEADER);
  }
  if (isApiPath(target.pathname)) {
    headers.set(IDENTITY_ENTRY_HOST_HEADER,
      incoming.hostname === HONGTAI_CONSOLE_HOST ? 'api.hbbtzn.com' : incoming.hostname);
  } else {
    headers.delete(IDENTITY_ENTRY_HOST_HEADER);
  }
  return new Request(target, {
    method: request.method,
    headers,
    redirect: 'manual',
    ...(request.method === 'GET' || request.method === 'HEAD' ? {} : { body: request.body }),
  });
}

async function publicResponse(
  request: Request,
  upstream: Response,
  nodeRoute?: HongtaiNodeRoute,
): Promise<Response> {
  const incoming = new URL(request.url);
  const headers = new Headers(upstream.headers);
  const publicOrigins = incoming.hostname === ROOT_STOREFRONT_HOST
    ? STOREFRONT_PUBLIC_ORIGINS
    : CONTROL_PUBLIC_ORIGINS;
  const requestOrigin = request.headers.get('origin');
  const upstreamAllowedOrigin = headers.get('access-control-allow-origin');
  const normalizedRequestOrigin = requestOrigin === null
    ? null
    : nodeRoute
      ? requestOrigin
      : rewriteOrigins(requestOrigin, UPSTREAM_REQUEST_ORIGINS);
  if (requestOrigin !== null && upstreamAllowedOrigin === normalizedRequestOrigin) {
    headers.set('access-control-allow-origin', requestOrigin);
  }
  for (const header of ['content-security-policy', 'location', 'refresh']) {
    const value = headers.get(header);
    if (value) headers.set(header, rewriteOrigins(value, publicOrigins));
  }
  const contentType = headers.get('content-type')?.toLowerCase() ?? '';
  const html = contentType.startsWith('text/html');
  const immutableConsoleArtifact = incoming.hostname === HONGTAI_CONSOLE_HOST;
  const rewritten = html && !immutableConsoleArtifact;
  const source = rewritten ? await upstream.text() : undefined;
  const body = html
    && !immutableConsoleArtifact ? publicHtml(request, source!, publicOrigins) : upstream.body;
  if (rewritten) {
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

function publicHtml(request: Request, source: string, publicOrigins: Readonly<Record<string, string>>): string {
  const publicOrigin = new URL(request.url).origin;
  const publicSource = rewriteOrigins(source, publicOrigins)
    .replaceAll('https://h5.zhudatuan.com', publicOrigin)
    .replaceAll('https://zhudatuan.com', publicOrigin);
  const controlHost = new URL(request.url).hostname;
  if (controlHost !== HONGTAI_CONSOLE_HOST && controlHost !== 'accounts.hbbtzn.com') return publicSource;
  return publicSource
    .replaceAll('href="/assets/', `href="${HONGTAI_CONTROL_ASSET_PREFIX}`)
    .replaceAll('src="/assets/', `src="${HONGTAI_CONTROL_ASSET_PREFIX}`);
}

const worker = {
  async fetch(request: Request): Promise<Response> {
    const incoming = new URL(request.url);

    const verification = wechatVerificationResponse(request, incoming);
    if (verification) return verification;

    if (incoming.hostname === HONGTAI_CONSOLE_HOST && incoming.pathname === '/') {
      incoming.pathname = HONGTAI_CONSOLE_SCOPE;
      return Response.redirect(incoming, 308);
    }

    if (incoming.hostname === 'accounts.hbbtzn.com') {
      const target = incoming.searchParams.get('target');
      const client = incoming.searchParams.get('client');
      const application = incoming.searchParams.get('application');
      const declaresConsumer = target?.startsWith('storefront')
        || application === HONGTAI_CONSUMER_APPLICATION
        || application === 'zhudatuan-storefront';
      if (declaresConsumer) {
        if (application !== HONGTAI_CONSUMER_APPLICATION || target !== 'storefront-hbbtzn') {
          incoming.searchParams.set('target', 'storefront-hbbtzn');
          incoming.searchParams.set('surface', 'web');
          incoming.searchParams.set('application', HONGTAI_CONSUMER_APPLICATION);
          incoming.searchParams.delete('client');
          incoming.searchParams.delete('admin_origin');
          return Response.redirect(incoming, 308);
        }
      } else if (target === 'console' || client === 'console') {
        if (target === 'console') incoming.searchParams.set('target', 'console-hbbtzn');
        if (client === 'console') incoming.searchParams.set('client', 'console-hbbtzn');
        incoming.searchParams.set('admin_origin', HONGTAI_CONSOLE_ORIGIN);
        return Response.redirect(incoming, 308);
      } else if ((target && target !== 'console-hbbtzn')
        || (client && client !== 'console-hbbtzn')
        || (incoming.searchParams.has('admin_origin')
          && incoming.searchParams.get('admin_origin') !== HONGTAI_CONSOLE_ORIGIN)) {
        return new Response('AUTH_NODE_MISMATCH', { status: 409 });
      }
    }

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

    if (incoming.hostname === ROOT_STOREFRONT_HOST && isConsumerAccountPath(incoming.pathname)) {
      const target = new URL(`${consumerAccountUpstreamPath(incoming.pathname)}${incoming.search}`, HONGTAI_ACCOUNTS_ORIGIN);
      target.searchParams.set('target', 'storefront-hbbtzn');
      target.searchParams.set('surface', 'web');
      target.searchParams.set('application', HONGTAI_CONSUMER_APPLICATION);
      return Response.redirect(target, request.method === 'GET' || request.method === 'HEAD' ? 308 : 307);
    }

    const path = controlAssetUpstreamPath(incoming) ?? storefrontPath(request, incoming);
    const target = new URL(`${path}${incoming.search}`, isApiPath(path) ? API_UPSTREAM_ORIGIN : upstreamOrigin);
    const nodeRoute = hongtaiNodeRoute(request, incoming, path);
    return await publicResponse(
      request,
      await fetch(upstreamRequest(request, target, nodeRoute), { redirect: 'manual' }),
      nodeRoute,
    );
  },
};

export default worker;
