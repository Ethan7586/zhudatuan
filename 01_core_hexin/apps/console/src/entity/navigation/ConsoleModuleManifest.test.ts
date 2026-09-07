import { describe, expect, it } from 'vitest';
import {
  consoleModuleIds,
  defineConsoleModuleManifest,
  isConsoleModuleId,
  type ConsoleModuleManifest,
  type ConsoleModuleRoute,
  type ConsoleRouteHandle,
  type NavigationConfig,
} from './ConsoleModuleManifest';

const productsModule = defineConsoleModuleManifest({
  id: 'products',
  status: 'enabled',
  navigation: {
    placement: 'main',
    group: 'commerce',
    order: 40,
    label: '商品治理台',
    icon: 'products',
    labelByScopeKind: { mall: '商品管理' },
    preferredScopeKind: 'mall',
  },
  routes: [{
    id: 'products.index',
    path: 'products',
    kind: 'entry',
    lazy: async () => ({ Component: () => null }),
    operations: ['catalog.listings.read'],
    presentation: {
      title: '商品管理',
      summary: '核心商品、可售状态和批量任务',
      byScopeKind: { mall: { title: '商城商品管理', summary: '当前商城商品与可售状态' } },
    },
  }],
} as const satisfies ConsoleModuleManifest<'products'>);

const productsHandle: ConsoleRouteHandle<'products'> = {
  moduleId: 'products',
  routeId: 'products.index',
  kind: 'entry',
  operations: ['catalog.listings.read'],
  presentation: { title: '商品管理', summary: '核心商品、可售状态和批量任务' },
};

const invalidOperationRoute = {
  id: 'products.invalid-operation',
  path: 'products/invalid-operation',
  kind: 'entry',
  lazy: async () => ({ Component: () => null }),
  operations: [
    // @ts-expect-error OperationId must come from the contract catalog.
    'catalog.listings.typo',
  ],
  presentation: { title: '无效操作', summary: '类型负夹具' },
} as const satisfies ConsoleModuleRoute<'products'>;

const invalidRoutePrefix = {
  // @ts-expect-error A products route id must use the products prefix.
  id: 'orders.index',
  path: 'products/wrong-prefix',
  kind: 'entry',
  lazy: async () => ({ Component: () => null }),
  operations: [],
  presentation: { title: '错误前缀', summary: '类型负夹具' },
} as const satisfies ConsoleModuleRoute<'products'>;

const invalidNoneNavigation: NavigationConfig = {
  placement: 'none',
  group: null,
  order: 120,
  label: '数据报表',
  // @ts-expect-error placement none must not carry an icon.
  icon: 'trend',
};

void invalidOperationRoute;
void invalidRoutePrefix;
void invalidNoneNavigation;

describe('ConsoleModuleManifest', () => {
  it('publishes the approved module id set and narrows known ids', () => {
    expect(consoleModuleIds).toEqual([
      'cockpit', 'control', 'applications', 'products', 'orders', 'referral', 'channels',
      'vouchers', 'finance', 'storefront-members', 'access', 'qualification', 'reports', 'support',
    ]);
    expect(isConsoleModuleId('products')).toBe(true);
    expect(isConsoleModuleId('unknown')).toBe(false);
  });

  it('preserves manifest and handle literals while checking OperationId', () => {
    expect(productsModule.routes[0]?.operations).toEqual(['catalog.listings.read']);
    expect(productsModule.navigation.labelByScopeKind?.mall).toBe('商品管理');
    expect(productsModule.routes[0]?.presentation.byScopeKind?.mall?.title).toBe('商城商品管理');
    expect(productsHandle.moduleId).toBe('products');
  });
});
