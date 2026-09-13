import type { ConsoleAppConfig } from '@shop/config/sfl-console-runtime';

interface ScopeCandidate {
  readonly kind?: string;
  readonly id?: string;
}

interface SessionCandidate {
  readonly accessVersion?: number;
  readonly capabilities?: readonly string[];
  readonly permissions?: readonly string[];
  readonly scope?: ScopeCandidate;
  readonly scopes?: readonly ScopeCandidate[];
}

interface Tracked<T> {
  settled: boolean;
  promise: Promise<T | undefined>;
}

const consoleKinds = Object.freeze(['platform', 'distributor', 'tenant', 'enterprise', 'mall']);

export function startDocumentPrefetch(
  appConfig: Pick<ConsoleAppConfig, 'apiBaseUrl' | 'clientVersion'>,
): void {
  const controllers = new Set<AbortController>();
  window.__consoleAbortDocumentPrefetch = () => {
    for (const controller of controllers) controller.abort();
    controllers.clear();
  };

  const readJson = <T>(path: string, extraHeaders: Readonly<Record<string, string>> = {}): Tracked<T> => {
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = window.setTimeout(() => controller.abort(), 1_500);
    return tracked(fetch(`${appConfig.apiBaseUrl}${path}`, {
      credentials: 'include',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'x-contract-version': '1.0.0',
        'x-client-version': appConfig.clientVersion,
        'x-trace-id': crypto.randomUUID(),
        ...extraHeaders,
      },
    }).then(async (response) => {
      if (!response.ok) return undefined;
      try { return await response.json() as T; } catch { return undefined; }
    }, () => undefined).finally(() => {
      window.clearTimeout(timeout);
      controllers.delete(controller);
    }));
  };

  const session = readJson<SessionCandidate>('/api/v1/identity/session');
  window.__consoleSessionPrefetch = tracked(session.promise.then((value) => value === undefined ? undefined : { value }));
  window.__consoleScopePrefetch = tracked(session.promise.then(async (value) => {
    if (value === undefined) return undefined;
    const roots = Array.isArray(value?.scopes) ? value.scopes.filter(isConsoleScope) : [];
    if (!Number.isInteger(value?.accessVersion) || roots.length === 0) return undefined;
    const headers = { 'x-access-version': String(value.accessVersion) };
    const profile = readJson<unknown>('/api/v1/members/me', headers);
    const canReadLayers = Array.isArray(value.permissions) && value.permissions.includes('organization.layer.read')
      && Array.isArray(value.capabilities) && value.capabilities.includes('organization.layers.read');
    const layers = canReadLayers ? roots.map(async (scope) => ({
      scopeKind: scope.kind,
      scopeId: scope.id,
      value: await readJson<unknown>('/api/v1/organizations/layers?limit=1000', {
        ...headers,
        'x-scope-hint': scope.id,
      }).promise,
    })) : [];
    return {
      accessVersion: value.accessVersion!,
      roots: roots.map((scope) => ({ kind: scope.kind, id: scope.id })),
      profile: await profile.promise,
      layers: await Promise.all(layers),
    };
  }));
  window.__consoleCockpitPrefetch = tracked(session.promise.then((value) => {
    if (value === undefined) return undefined;
    const match = location.pathname.match(/^\/scopes\/(platform|distributor|tenant|enterprise|mall)\/([^/]+)\/cockpit\/?$/);
    let direct: Readonly<{ kind: string; id: string }> | undefined;
    try { direct = match === null ? undefined : { kind: match[1]!, id: decodeURIComponent(match[2]!) }; } catch { direct = undefined; }
    if (location.pathname !== '/' && direct === undefined) return undefined;
    const first = direct ?? (Array.isArray(value?.scopes) ? value.scopes.find(isConsoleScope) : undefined) ?? value?.scope;
    if (!isConsoleScope(first) || !Number.isInteger(value?.accessVersion)) return undefined;
    const requested = new URLSearchParams(location.search).get('period');
    const period = requested !== null && ['realtime', 'yesterday', '7days', '30days'].includes(requested) ? requested : '30days';
    return readJson<unknown>(`/api/v1/reports/dashboard?period=${period}&limit=100`, {
      'x-scope-hint': first.id,
      'x-access-version': String(value.accessVersion),
    }).promise.then((dashboard) => dashboard === undefined ? undefined : {
      scopeKind: first.kind,
      scopeId: first.id,
      accessVersion: value.accessVersion!,
      period,
      value: dashboard,
    });
  }));
  window.__consoleProductPrefetch = tracked(session.promise.then((value) => {
    if (value === undefined || !Number.isInteger(value?.accessVersion)
      || !Array.isArray(value.capabilities) || !value.capabilities.includes('catalog.listings.read')) return undefined;
    const match = location.pathname.match(/^\/scopes\/(platform|distributor|tenant|enterprise|mall)\/([^/]+)\/(products|supply-chain)\/?$/);
    let direct: Readonly<{ kind: 'platform' | 'distributor' | 'tenant' | 'enterprise' | 'mall'; id: string }> | undefined;
    try {
      const candidate = match?.[1] === undefined ? undefined : { kind: match[1], id: decodeURIComponent(match[2]!) };
      direct = isConsoleScope(candidate) ? candidate : undefined;
    } catch { direct = undefined; }
    if (direct === undefined) return undefined;
    const supplyNetwork = match?.[3] === 'supply-chain';
    const requestedLimit = Number(new URLSearchParams(location.search).get('limit') ?? 50);
    const limit = supplyNetwork ? 1 : [20, 50, 100].includes(requestedLimit) ? requestedLimit : 50;
    const search = new URLSearchParams(location.search);
    const preview = supplyNetwork || (direct.kind === 'platform' && direct.id === 'platform:preview');
    const query: Readonly<{
      q: string; category: string; supplier: string; mall: string; status: string;
      cursor?: string; limit: number; preview: boolean; view?: 'supply-network';
    }> = {
      q: supplyNetwork ? '' : search.get('q') ?? '',
      category: supplyNetwork ? '' : search.get('category') ?? '',
      supplier: supplyNetwork ? '' : preview ? (search.get('supplier') ?? '') : '',
      mall: supplyNetwork ? '' : preview ? (search.get('mall') ?? '') : '',
      status: supplyNetwork ? '' : search.get('status') ?? '',
      ...(!supplyNetwork && search.get('cursor') !== null ? { cursor: search.get('cursor')! } : {}),
      limit,
      preview,
      ...(supplyNetwork ? { view: 'supply-network' as const } : {}),
    };
    const parameters = new URLSearchParams({ limit: String(limit) });
    if (query.q !== '') parameters.set('q', query.q);
    if (query.category !== '') parameters.set('category', query.category);
    if (query.supplier !== '') parameters.set('supplier', query.supplier);
    if (query.mall !== '') parameters.set('mall', query.mall);
    if (query.status !== '') parameters.set('status', query.status);
    if (query.cursor !== undefined) parameters.set('cursor', query.cursor);
    if (query.view !== undefined) parameters.set('view', query.view);
    return readJson<unknown>(`/api/v1/catalog/listings?${parameters.toString()}`, {
      'x-scope-hint': direct.id,
      'x-access-version': String(value.accessVersion),
    }).promise.then((products) => products === undefined ? undefined : {
      scopeKind: direct.kind,
      scopeId: direct.id,
      accessVersion: value.accessVersion!,
      query,
      value: products,
    });
  }));
  window.__consoleSupportPrefetch = tracked(session.promise.then((value) => {
    if (value === undefined || !Number.isInteger(value?.accessVersion)
      || !Array.isArray(value.capabilities) || !value.capabilities.includes('support.cases.read')) return undefined;
    const match = location.pathname.match(/^\/scopes\/(platform|distributor|tenant|enterprise|mall)\/([^/]+)\/support(?:\/[^/]+)?\/?$/);
    let direct: Readonly<{ kind: 'platform' | 'distributor' | 'tenant' | 'enterprise' | 'mall'; id: string }> | undefined;
    try {
      const candidate = match?.[1] === undefined ? undefined : { kind: match[1], id: decodeURIComponent(match[2]!) };
      direct = isConsoleScope(candidate) ? candidate : undefined;
    } catch { direct = undefined; }
    if (direct === undefined) return undefined;
    return readJson<unknown>('/api/v1/support/cases?limit=50', {
      'x-scope-hint': direct.id,
      'x-access-version': String(value.accessVersion),
    }).promise.then((cases) => cases === undefined ? undefined : {
      scopeKind: direct.kind,
      scopeId: direct.id,
      accessVersion: value.accessVersion!,
      value: cases,
    });
  }));
}

function tracked<T>(promise: Promise<T | undefined>): Tracked<T> {
  const slot: Tracked<T> = { settled: false, promise: Promise.resolve(undefined) };
  slot.promise = Promise.resolve(promise).catch(() => undefined).finally(() => { slot.settled = true; });
  return slot;
}

function isConsoleScope(value: ScopeCandidate | undefined): value is Readonly<{
  kind: 'platform' | 'distributor' | 'tenant' | 'enterprise' | 'mall';
  id: string;
}> {
  return value !== undefined && typeof value.kind === 'string' && consoleKinds.includes(value.kind)
    && typeof value.id === 'string';
}
