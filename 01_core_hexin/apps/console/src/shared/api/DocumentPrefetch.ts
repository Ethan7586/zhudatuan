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

interface EarlySessionPrefetch extends Tracked<unknown> {
  readonly apiBaseUrl: string;
  readonly clientVersion: string;
  readonly abort: () => void;
  readonly scope?: Tracked<unknown>;
}

declare global {
  interface Window {
    __consoleEarlySessionPrefetch?: EarlySessionPrefetch;
  }
}

const consoleKinds = Object.freeze(['platform', 'distributor', 'tenant', 'enterprise', 'mall']);

export function startDocumentPrefetch(
  appConfig: Pick<ConsoleAppConfig, 'apiBaseUrl' | 'clientVersion'>,
): void {
  const earlySession = window.__consoleEarlySessionPrefetch;
  delete window.__consoleEarlySessionPrefetch;
  const useEarlySession = earlySession !== undefined
    && normalizeBaseUrl(earlySession.apiBaseUrl) === normalizeBaseUrl(appConfig.apiBaseUrl)
    && earlySession.clientVersion === appConfig.clientVersion;
  if (earlySession !== undefined && !useEarlySession) earlySession.abort();
  const controllers = new Set<AbortController>();
  window.__consoleAbortDocumentPrefetch = () => {
    if (useEarlySession) earlySession.abort();
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

  const session = useEarlySession
    ? tracked(earlySession.promise.then((value) => isRecord(value) ? value as SessionCandidate : undefined))
    : readJson<SessionCandidate>('/api/v1/identity/session');
  window.__consoleSessionPrefetch = tracked(session.promise.then((value) => value === undefined ? undefined : { value }));
  const startScopePrefetch = () => tracked(session.promise.then(async (value) => {
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
  window.__consoleScopePrefetch = useEarlySession && earlySession.scope !== undefined
    ? earlySession.scope as ReturnType<typeof startScopePrefetch>
    : startScopePrefetch();
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
  window.__consoleQualificationPrefetch = tracked(session.promise.then((value) => {
    if (value === undefined || !Number.isInteger(value?.accessVersion)
      || !Array.isArray(value.capabilities) || !value.capabilities.includes('qualification.center.read')) return undefined;
    const match = location.pathname.match(/^\/scopes\/(platform|distributor|tenant|enterprise|mall)\/([^/]+)\/settings\/qualification\/?$/);
    let direct: Readonly<{ kind: 'platform' | 'distributor' | 'tenant' | 'enterprise' | 'mall'; id: string }> | undefined;
    try {
      const candidate = match?.[1] === undefined ? undefined : { kind: match[1], id: decodeURIComponent(match[2]!) };
      direct = isConsoleScope(candidate) ? candidate : undefined;
    } catch { direct = undefined; }
    if (direct === undefined) return undefined;
    return readJson<unknown>('/api/v1/qualifications?limit=50', {
      'x-scope-hint': direct.id,
      'x-access-version': String(value.accessVersion),
    }).promise.then((qualifications) => qualifications === undefined ? undefined : {
      scopeKind: direct.kind,
      scopeId: direct.id,
      accessVersion: value.accessVersion!,
      value: qualifications,
    });
  }));
  window.__consoleOrderPrefetch = tracked(session.promise.then((value) => {
    if (value === undefined || !Number.isInteger(value?.accessVersion)
      || !Array.isArray(value.capabilities) || !value.capabilities.includes('order.orders.read')) return undefined;
    const match = location.pathname.match(/^\/scopes\/(platform|distributor|tenant|enterprise|mall)\/([^/]+)\/orders\/?$/);
    let direct: Readonly<{ kind: 'platform' | 'distributor' | 'tenant' | 'enterprise' | 'mall'; id: string }> | undefined;
    try {
      const candidate = match?.[1] === undefined ? undefined : { kind: match[1], id: decodeURIComponent(match[2]!) };
      direct = isConsoleScope(candidate) ? candidate : undefined;
    } catch { direct = undefined; }
    if (direct === undefined) return undefined;
    const search = new URLSearchParams(location.search);
    const query = {
      order: search.get('order') ?? '',
      placed: search.get('placed') ?? '',
      lifecycle: search.get('lifecycle') ?? '',
      payment: search.get('payment') ?? '',
      fulfillment: search.get('fulfillment') ?? '',
      mall: search.get('mall') ?? '',
      view: search.get('view') ?? 'all',
      ...(search.get('cursor') !== null ? { cursor: search.get('cursor')! } : {}),
    } as const;
    const parameters = new URLSearchParams({ limit: '50', exports: 'true' });
    if (query.order !== '') parameters.set('order', query.order);
    if (query.placed !== '') parameters.set('placed', query.placed);
    if (query.lifecycle !== '') parameters.set('lifecycle', query.lifecycle);
    if (query.payment !== '') parameters.set('payment', query.payment);
    if (query.fulfillment !== '') parameters.set('fulfillment', query.fulfillment);
    if (query.mall !== '') parameters.set('mall', query.mall);
    if (query.view !== 'all') parameters.set('view', query.view);
    if (query.cursor !== undefined) parameters.set('cursor', query.cursor);
    return readJson<unknown>(`/api/v1/orders?${parameters.toString()}`, {
      'x-scope-hint': direct.id,
      'x-access-version': String(value.accessVersion),
    }).promise.then((orders) => orders === undefined ? undefined : {
      scopeKind: direct.kind,
      scopeId: direct.id,
      accessVersion: value.accessVersion!,
      query,
      value: orders,
    });
  }));
  window.__consoleFinanceOverviewPrefetch = tracked(session.promise.then((value) => {
    if (value === undefined || !Number.isInteger(value?.accessVersion)
      || !Array.isArray(value.capabilities) || !value.capabilities.includes('finance.overview.read')) return undefined;
    const direct = directScopeFor('finance');
    if (direct === undefined) return undefined;
    return readJson<unknown>('/api/v1/finance/overview', {
      'x-scope-hint': direct.id,
      'x-access-version': String(value.accessVersion),
    }).promise.then((overview) => overview === undefined ? undefined : {
      scopeKind: direct.kind,
      scopeId: direct.id,
      accessVersion: value.accessVersion!,
      value: overview,
    });
  }));
  window.__consoleFinanceReconciliationPrefetch = tracked(session.promise.then((value) => {
    if (value === undefined || !Number.isInteger(value?.accessVersion)
      || !Array.isArray(value.capabilities) || !value.capabilities.includes('finance.reconciliations.read')) return undefined;
    const direct = directScopeFor('finance');
    if (direct === undefined) return undefined;
    const search = new URLSearchParams(location.search);
    const requestedTab = search.get('tab') ?? 'payments';
    const tab = ['payments', 'refunds', 'rules', 'audit'].includes(requestedTab) ? requestedTab : 'payments';
    if (tab !== 'payments') return undefined;
    const preview = direct.kind === 'platform' && direct.id === 'platform:preview';
    const requestedLimit = Number(search.get('limit') ?? 50);
    const query = {
      q: preview ? search.get('q') ?? '' : '',
      period: preview ? search.get('reconPeriod') ?? '' : '',
      channel: preview ? search.get('channel') ?? '' : '',
      mall: preview ? search.get('mall') ?? '' : '',
      status: preview ? search.get('status') ?? '' : '',
      difference: preview ? search.get('difference') ?? '' : '',
      ...(search.get('cursor') !== null ? { cursor: search.get('cursor')! } : {}),
      limit: [20, 50].includes(requestedLimit) ? requestedLimit : 50,
    } as const;
    const parameters = new URLSearchParams({ limit: String(query.limit) });
    if (query.cursor !== undefined) parameters.set('cursor', query.cursor);
    if (query.q !== '') parameters.set('q', query.q);
    if (query.period !== '') parameters.set('period', query.period);
    if (query.channel !== '') parameters.set('channel', query.channel);
    if (query.mall !== '') parameters.set('mall', query.mall);
    if (query.status !== '') parameters.set('status', query.status);
    if (query.difference !== '') parameters.set('difference', query.difference);
    return readJson<unknown>(`/api/v1/finance/reconciliations?${parameters.toString()}`, {
      'x-scope-hint': direct.id,
      'x-access-version': String(value.accessVersion),
    }).promise.then((reconciliations) => reconciliations === undefined ? undefined : {
      scopeKind: direct.kind,
      scopeId: direct.id,
      accessVersion: value.accessVersion!,
      query,
      value: reconciliations,
    });
  }));
  window.__consoleApplicationPrefetch = tracked(session.promise.then((value) => {
    if (value === undefined || !Number.isInteger(value?.accessVersion)
      || !Array.isArray(value.capabilities) || !value.capabilities.includes('experience.applications.read')) return undefined;
    const direct = directScopeFor('applications');
    if (direct === undefined) return undefined;
    const cursor = new URLSearchParams(location.search).get('cursor') ?? undefined;
    const parameters = new URLSearchParams({ limit: '50' });
    if (cursor !== undefined) parameters.set('cursor', cursor);
    return readJson<unknown>(`/api/v1/experiences/applications?${parameters.toString()}`, {
      'x-scope-hint': direct.id,
      'x-access-version': String(value.accessVersion),
    }).promise.then((applications) => applications === undefined ? undefined : {
      scopeKind: direct.kind,
      scopeId: direct.id,
      accessVersion: value.accessVersion!,
      ...(cursor === undefined ? {} : { cursor }),
      value: applications,
    });
  }));
  window.__consoleMemberPrefetch = tracked(session.promise.then((value) => {
    if (value === undefined || !Number.isInteger(value?.accessVersion)
      || !Array.isArray(value.capabilities) || !value.capabilities.includes('member.members.read')) return undefined;
    const direct = directScopeFor('settings/members');
    if (direct === undefined) return undefined;
    const cursor = new URLSearchParams(location.search).get('cursor') ?? undefined;
    const parameters = new URLSearchParams({ limit: '20' });
    if (cursor !== undefined) parameters.set('cursor', cursor);
    return readJson<unknown>(`/api/v1/members?${parameters.toString()}`, {
      'x-scope-hint': direct.id,
      'x-access-version': String(value.accessVersion),
    }).promise.then((members) => members === undefined ? undefined : {
      scopeKind: direct.kind,
      scopeId: direct.id,
      accessVersion: value.accessVersion!,
      ...(cursor === undefined ? {} : { cursor }),
      value: members,
    });
  }));
  window.__consoleAccessPrefetch = tracked(session.promise.then((value) => {
    if (value === undefined || !Number.isInteger(value?.accessVersion)
      || !Array.isArray(value.capabilities) || !value.capabilities.includes('access.center.read')) return undefined;
    const direct = directScopeFor('settings/members');
    if (direct === undefined) return undefined;
    return readJson<unknown>('/api/v1/access/center?limit=500', {
      'x-scope-hint': direct.id,
      'x-access-version': String(value.accessVersion),
    }).promise.then((access) => access === undefined ? undefined : {
      scopeKind: direct.kind,
      scopeId: direct.id,
      accessVersion: value.accessVersion!,
      value: access,
    });
  }));
  window.__consoleVoucherPrefetch = tracked(session.promise.then((value) => {
    if (value === undefined || !Number.isInteger(value?.accessVersion) || !Array.isArray(value.capabilities)) return undefined;
    const direct = directScopeFor('vouchers');
    if (direct === undefined) return undefined;
    const search = new URLSearchParams(location.search);
    const requested = search.get('view');
    const operations = {
      programs: 'voucher.programs.read', libraries: 'voucher.cardlibraries.read',
      reserves: 'voucher.reserves.read', batches: 'voucher.batches.read',
    } as const;
    const views = ['programs', 'libraries', 'reserves', 'batches'] as const;
    const view = views.includes(requested as typeof views[number])
      ? requested as typeof views[number]
      : views.find((candidate) => value.capabilities!.includes(operations[candidate])) ?? 'programs';
    if (!value.capabilities.includes(operations[view])) return undefined;
    const cursor = search.get('cursor') ?? undefined;
    const paths = {
      programs: '/api/v1/vouchers/programs', libraries: '/api/v1/vouchers/cardlibraries',
      reserves: '/api/v1/vouchers/reserves', batches: '/api/v1/vouchers/batches',
    } as const;
    const parameters = new URLSearchParams({ limit: '50' });
    if (cursor !== undefined) parameters.set('cursor', cursor);
    return readJson<unknown>(`${paths[view]}?${parameters.toString()}`, {
      'x-scope-hint': direct.id,
      'x-access-version': String(value.accessVersion),
    }).promise.then((vouchers) => vouchers === undefined ? undefined : {
      scopeKind: direct.kind,
      scopeId: direct.id,
      accessVersion: value.accessVersion!,
      view,
      ...(cursor === undefined ? {} : { cursor }),
      value: vouchers,
    });
  }));
  window.__consoleReportPrefetch = tracked(session.promise.then((value) => {
    if (value === undefined || !Number.isInteger(value?.accessVersion) || !Array.isArray(value.capabilities)) return undefined;
    const direct = directScopeFor('reports');
    if (direct === undefined) return undefined;
    const search = new URLSearchParams(location.search);
    const reportViews = ['sales', 'products', 'malls', 'categories', 'channels', 'powderclass', 'voucher', 'fulfillment', 'settlements'] as const;
    const supplierViews = ['sales', 'products', 'categories', 'channels', 'fulfillment', 'settlements'] as const;
    const rawView = search.get('view');
    const requested = reportViews.includes(rawView as typeof reportViews[number]) ? rawView as typeof reportViews[number] : 'sales';
    const supplier = search.get('supplier') ?? undefined;
    const view = supplier !== undefined && !supplierViews.includes(requested as typeof supplierViews[number]) ? 'sales' : requested;
    const rawPeriod = search.get('period');
    const periods = ['realtime', 'yesterday', '7days', '30days'] as const;
    const period = periods.includes(rawPeriod as typeof periods[number]) ? rawPeriod as typeof periods[number] : '30days';
    const cursor = search.get('cursor') ?? undefined;
    const operation = view === 'voucher' ? 'reporting.voucherconsumption.read'
      : view === 'fulfillment' || view === 'settlements' ? 'reporting.sales.read' : `reporting.${view}.read`;
    if (!value.capabilities.includes(operation)) return undefined;
    const paths = {
      sales: 'sales', products: 'products', malls: 'malls', categories: 'categories', channels: 'channels',
      powderclass: 'powderclass', voucher: 'voucherconsumption', fulfillment: 'sales', settlements: 'sales',
    } as const;
    const supplierSections = {
      sales: 'sales', products: 'product', malls: 'malls', categories: 'category', channels: 'channel',
      powderclass: 'powderclass', voucher: 'voucher', fulfillment: 'fulfillment', settlements: 'settlement',
    } as const;
    const parameters = new URLSearchParams({ limit: '50', period });
    if (cursor !== undefined) parameters.set('cursor', cursor);
    if (supplier !== undefined) {
      parameters.set('supplierid', supplier);
      parameters.set('suppliersection', supplierSections[view]);
    }
    return readJson<unknown>(`/api/v1/reports/${paths[view]}?${parameters.toString()}`, {
      'x-scope-hint': direct.id,
      'x-access-version': String(value.accessVersion),
    }).promise.then((report) => report === undefined ? undefined : {
      scopeKind: direct.kind,
      scopeId: direct.id,
      accessVersion: value.accessVersion!,
      view,
      period,
      ...(cursor === undefined ? {} : { cursor }),
      ...(supplier === undefined ? {} : { supplier }),
      value: report,
    });
  }));
  window.__consoleReportSupplierPrefetch = tracked(session.promise.then((value) => {
    if (value === undefined || !Number.isInteger(value?.accessVersion)
      || !Array.isArray(value.capabilities) || !value.capabilities.includes('catalog.listings.read')) return undefined;
    const direct = directScopeFor('reports');
    if (direct === undefined) return undefined;
    return readJson<unknown>('/api/v1/catalog/listings?limit=100', {
      'x-scope-hint': direct.id,
      'x-access-version': String(value.accessVersion),
    }).promise.then((listings) => listings === undefined ? undefined : {
      scopeKind: direct.kind,
      scopeId: direct.id,
      accessVersion: value.accessVersion!,
      value: listings,
    });
  }));
}

function directScopeFor(suffix: string): Readonly<{
  kind: 'platform' | 'distributor' | 'tenant' | 'enterprise' | 'mall';
  id: string;
}> | undefined {
  const match = location.pathname.match(new RegExp(`^/scopes/(platform|distributor|tenant|enterprise|mall)/([^/]+)/${suffix}/?$`));
  try {
    const candidate = match?.[1] === undefined ? undefined : { kind: match[1], id: decodeURIComponent(match[2]!) };
    return isConsoleScope(candidate) ? candidate : undefined;
  } catch { return undefined; }
}

function tracked<T>(promise: Promise<T | undefined>): Tracked<T> {
  const slot: Tracked<T> = { settled: false, promise: Promise.resolve(undefined) };
  slot.promise = Promise.resolve(promise).catch(() => undefined).finally(() => { slot.settled = true; });
  return slot;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isConsoleScope(value: ScopeCandidate | undefined): value is Readonly<{
  kind: 'platform' | 'distributor' | 'tenant' | 'enterprise' | 'mall';
  id: string;
}> {
  return value !== undefined && typeof value.kind === 'string' && consoleKinds.includes(value.kind)
    && typeof value.id === 'string';
}
