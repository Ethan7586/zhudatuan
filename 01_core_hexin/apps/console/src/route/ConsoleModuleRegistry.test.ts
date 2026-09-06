import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type {
  ConsoleModuleId,
  ConsoleModuleManifest,
  ConsoleModuleRoute,
} from '../entity/navigation/ConsoleModuleManifest';
import {
  consoleModuleById,
  consoleModuleRegistryIssues,
  consoleModules,
  defineConsoleModuleRegistry,
} from './ConsoleModuleRegistry';

const lazy = async () => ({ Component: () => null });

function route<TModuleId extends ConsoleModuleId>(
  moduleId: TModuleId,
  id: `${TModuleId}.${string}`,
  path: string,
  kind: 'entry' | 'detail' = 'entry',
): ConsoleModuleRoute<TModuleId> {
  void moduleId;
  return {
    id,
    path,
    kind,
    lazy,
    operations: [],
    presentation: { title: id, summary: path },
  };
}

function manifest<TModuleId extends ConsoleModuleId>(
  id: TModuleId,
  routes: readonly ConsoleModuleRoute<TModuleId>[],
): ConsoleModuleManifest<TModuleId> {
  return {
    id,
    status: 'enabled',
    navigation: { placement: 'main', group: 'commerce', order: 1, label: id, icon: 'trend' },
    routes,
  };
}

describe('ConsoleModuleRegistry', () => {
  it('registers a valid lightweight manifest set', () => {
    const products = manifest('products', [route('products', 'products.index', 'products')]);
    const orders = manifest('orders', [route('orders', 'orders.index', 'orders')]);
    const registry = defineConsoleModuleRegistry([products, orders] as const);

    expect(registry.modules).toEqual([products, orders]);
    expect(registry.moduleById.get('products')).toBe(products);
    expect(consoleModuleRegistryIssues(registry.modules)).toEqual([]);
  });

  it('reports duplicate module ids, route ids, and paths', () => {
    const issues = consoleModuleRegistryIssues([
      manifest('products', [route('products', 'products.shared', 'shared')]),
      manifest('products', [route('products', 'products.shared', 'shared')]),
    ]);

    expect(issues.map(({ code }) => code)).toEqual([
      'duplicate-module-id', 'duplicate-route-id', 'duplicate-route-path',
    ]);
    expect(() => defineConsoleModuleRegistry([
      manifest('products', [route('products', 'products.shared', 'shared')]),
      manifest('products', [route('products', 'products.shared', 'shared')]),
    ])).toThrow(/duplicate-module-id:products:products/);
  });

  it.each([
    [[], '0'],
    [[
      route('products', 'products.first', 'products'),
      route('products', 'products.second', 'products/second'),
    ], '2'],
  ] as const)('requires exactly one entry route', (routes, count) => {
    expect(consoleModuleRegistryIssues([manifest('products', routes)])).toContainEqual({
      code: 'entry-count', moduleId: 'products', value: count,
    });
  });
});

describe('registered Console modules', () => {
  it('registers the 14 approved owners in order with one entry each', () => {
    expect(consoleModules.map(({ id }) => id)).toEqual([
      'cockpit', 'control', 'applications', 'products', 'orders', 'referral', 'channels',
      'vouchers', 'finance', 'storefront-members', 'access', 'qualification', 'reports', 'support',
    ]);
    expect(consoleModuleById.size).toBe(14);
    expect(consoleModuleRegistryIssues(consoleModules)).toEqual([]);
    for (const module of consoleModules) {
      expect(module.routes.filter(({ kind }) => kind === 'entry'), module.id).toHaveLength(1);
    }
  });

  it('records 32 lazy routes with unique ids and paths', () => {
    const routes: ConsoleModuleRoute<ConsoleModuleId>[] = [];
    for (const module of consoleModules) {
      for (const route of module.routes) routes.push(route as ConsoleModuleRoute<ConsoleModuleId>);
    }
    const routeIds = routes.map(({ id }) => id);
    const paths = routes.map(({ path }) => path);

    expect(routes.filter(({ kind }) => kind === 'redirect')).toHaveLength(0);
    expect(routes.filter(({ kind }) => kind !== 'redirect')).toHaveLength(33);
    expect(new Set(routeIds).size).toBe(routeIds.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('preserves enabled defaults with the platform-only merchant service entry', () => {
    expect(consoleModules.every(({ status }) => status === 'enabled')).toBe(true);
    expect(consoleModules.filter(({ navigation }) => navigation.placement === 'main').map(({ id }) => id)).toEqual([
      'cockpit', 'control', 'applications', 'products', 'orders', 'referral', 'channels',
      'vouchers', 'finance', 'storefront-members', 'access', 'qualification', 'reports',
    ]);
    expect(consoleModuleById.get('reports')?.navigation).toMatchObject({
      placement: 'main', group: 'overview', order: 15, icon: 'trend',
    });
    expect(consoleModuleById.get('control')?.navigation).toMatchObject({
      placement: 'main', group: 'overview', label: '商家服务中心', icon: 'control', scopeKinds: ['platform'],
    });
    expect(consoleModuleById.get('support')?.navigation).toMatchObject({ placement: 'bottom', label: '客服系统' });
    expect(consoleModuleById.get('referral')?.navigation).toMatchObject({ preferredScopeKind: 'mall' });
  });

  it('keeps exactly the four approved literal transition edges', () => {
    const manifestSources = [
      'src/feature/cockpit/manifest.ts',
      'src/feature/control/manifest.ts',
      'src/feature/application/manifest.ts',
      'src/feature/product/manifest.ts',
      'src/feature/order/manifest.ts',
      'src/feature/referral/manifest.ts',
      'src/feature/channel/manifest.ts',
      'src/feature/voucher/manifest.ts',
      'src/feature/finance/manifest.ts',
      'src/feature/storefront-member/manifest.ts',
      'src/feature/access/manifest.ts',
      'src/feature/qualification/manifest.ts',
      'src/feature/report/manifest.ts',
      'src/feature/support/manifest.ts',
    ] as const;
    const literalEdges = manifestSources.flatMap((source) => {
      const content = readFileSync(source, 'utf8');
      return [...content.matchAll(/lazy:\s*\(\)\s*=>\s*import\('([^']+)'\)/g)]
        .map(([, target]) => ({ source, target }));
    });
    const transitionEdges = literalEdges.filter(({ target }) => target?.startsWith('../'))
      .sort((left, right) => `${left.source}:${left.target}`.localeCompare(`${right.source}:${right.target}`));

    expect(literalEdges).toHaveLength(32);
    expect(transitionEdges).toEqual([
      { source: 'src/feature/access/manifest.ts', target: '../importing/ImportRoute' },
      { source: 'src/feature/access/manifest.ts', target: '../member/MemberRoute' },
      { source: 'src/feature/qualification/manifest.ts', target: '../notification/NotificationRoute' },
      { source: 'src/feature/voucher/manifest.ts', target: '../importing/ImportRoute' },
    ]);
  });
});
