import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryRouter,
  RouterProvider,
  type LazyRouteFunction,
  type NonIndexRouteObject,
} from 'react-router';
import type {
  ConsoleModuleManifest,
  ConsoleModuleStatus,
} from '../entity/navigation/ConsoleModuleManifest';
import { consoleModuleById, consoleModules } from './ConsoleModuleRegistry';
import { consoleScopeChildren } from './ConsoleRouter';
import {
  isConsoleRouteHandle,
  materializeConsoleIndexRoute,
  materializeConsoleModule,
  materializeConsoleModules,
  selectDefaultConsoleEntry,
} from './ConsoleModuleRoutes';
import { ModuleDisabledRoute } from './ModuleDisabledRoute';

afterEach(cleanup);

describe('Console module route materializer', () => {
  it('materializes enabled lazy and redirect routes with static handles', () => {
    const lazy = vi.fn(async () => ({ Component: BusinessRoute }));
    const routes = materializeConsoleModule(fixtureModule('enabled', lazy));

    expect(routes).toHaveLength(2);
    expect(routes[0]?.lazy).toBe(lazy);
    expect(routes[1]?.element).toBeDefined();
    expect(routes[1]?.Component).toBeUndefined();
    expect(routes.map(({ handle }) => handle)).toEqual([
      expect.objectContaining({ moduleId: 'cockpit', routeId: 'cockpit.index', kind: 'entry' }),
      expect.objectContaining({ moduleId: 'cockpit', routeId: 'cockpit.redirect', kind: 'redirect' }),
    ]);
  });

  it('materializes every disabled path with the shared disabled component and never calls business lazy', async () => {
    const lazy = vi.fn(async () => ({ Component: BusinessRoute }));
    const routes = materializeConsoleModule(fixtureModule('disabled', lazy));

    expect(routes.every(({ Component }) => Component === ModuleDisabledRoute)).toBe(true);
    expect(routes.every((route) => !('lazy' in route) && !('element' in route))).toBe(true);
    renderRouteObjects(routes, '/cockpit');
    expect(await screen.findByText('模块已停用')).toBeTruthy();
    expect(lazy).not.toHaveBeenCalled();
  });

  it('omits hidden routes so their direct URLs reach the existing wildcard 404', async () => {
    const lazy = vi.fn(async () => ({ Component: BusinessRoute }));
    const routes = materializeConsoleModule(fixtureModule('hidden', lazy));

    expect(routes).toEqual([]);
    renderRouteObjects(routes, '/cockpit');
    expect(await screen.findByText('页面不存在')).toBeTruthy();
    expect(lazy).not.toHaveBeenCalled();
  });

  it('injects a valid module handle into every registered route', () => {
    const routes = materializeConsoleModules(consoleModules);

    expect(routes).toHaveLength(32);
    for (const route of routes) {
      expect(isConsoleRouteHandle(route.handle), route.id).toBe(true);
    }
    expect(routes.map(({ handle }) => isConsoleRouteHandle(handle) ? handle.moduleId : undefined)
      .filter((moduleId, index, values) => values.indexOf(moduleId) === index)).toEqual([
        'cockpit', 'control', 'applications', 'products', 'orders', 'referral', 'channels',
        'vouchers', 'finance', 'access', 'qualification', 'reports', 'support',
      ]);
  });

  it('supplies the Router index, all registry routes, the profile route, and the existing wildcard', () => {
    expect(consoleScopeChildren).toHaveLength(35);
    expect(consoleScopeChildren[0]).toMatchObject({ index: true });
    expect(consoleScopeChildren.at(-2)).toMatchObject({ path: 'settings/profile' });
    expect(consoleScopeChildren.at(-1)).toMatchObject({ path: '*' });
    expect(consoleScopeChildren.slice(1, -2)
      .every((route) => 'handle' in route && isConsoleRouteHandle(route.handle))).toBe(true);
    expect('handle' in (consoleScopeChildren.at(-2) ?? {})).toBe(false);
  });

  it('selects only the first enabled main entry for the scope index', () => {
    const cockpit = consoleModuleById.get('cockpit');
    const control = consoleModuleById.get('control');
    const reports = consoleModuleById.get('reports');
    expect(cockpit).toBeDefined();
    expect(control).toBeDefined();
    expect(reports).toBeDefined();
    if (cockpit === undefined || control === undefined || reports === undefined) return;

    expect(selectDefaultConsoleEntry(consoleModules)).toBe('cockpit');
    expect(selectDefaultConsoleEntry([
      { ...cockpit, status: 'disabled' },
      { ...control, status: 'enabled' },
      { ...reports, status: 'enabled' },
    ])).toBe('reports');
    expect(selectDefaultConsoleEntry([
      { ...cockpit, status: 'hidden' },
      { ...control, status: 'disabled' },
      { ...reports, status: 'enabled' },
    ])).toBe('reports');
    expect(materializeConsoleIndexRoute([
      { ...cockpit, status: 'hidden' },
      { ...control, status: 'disabled' },
      { ...reports, status: 'enabled' },
    ])).toHaveProperty('element');
  });
});

function fixtureModule(
  status: ConsoleModuleStatus,
  lazy: LazyRouteFunction<NonIndexRouteObject>,
): ConsoleModuleManifest<'cockpit'> {
  return {
    id: 'cockpit',
    status,
    navigation: {
      placement: 'main',
      group: 'overview',
      order: 10,
      label: '经营驾驶舱',
      icon: 'trend',
    },
    routes: [
      {
        id: 'cockpit.index',
        path: 'cockpit',
        kind: 'entry',
        lazy,
        operations: [],
        presentation: { title: '经营驾驶舱', summary: '经营数据、宏观和细节趋势' },
      },
      {
        id: 'cockpit.redirect',
        path: 'cockpit-redirect',
        kind: 'redirect',
        redirectTo: 'cockpit',
        operations: [],
        presentation: { title: '经营驾驶舱', summary: '经营数据、宏观和细节趋势' },
      },
    ],
  };
}

function renderRouteObjects(routes: ReturnType<typeof materializeConsoleModule>, initialEntry: string) {
  const router = createMemoryRouter([{
    path: '/',
    children: [
      ...routes,
      { path: '*', Component: NotFoundFixture },
    ],
  }], { initialEntries: [initialEntry] });
  return render(<RouterProvider router={router} />);
}

function BusinessRoute() {
  return <h1>业务页面</h1>;
}

function NotFoundFixture() {
  return <h1>页面不存在</h1>;
}
