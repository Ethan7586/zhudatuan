import { describe, expect, it, vi } from 'vitest';
import { createConsoleInteractionTelemetry } from './ConsoleInteractionTelemetry';
import { consoleRoutePathMatches, createConsoleModulePreloader } from './ConsoleModulePreload';

describe('Console module preloader', () => {
  it('matches both entry and parameterized direct routes for document boot', () => {
    expect(consoleRoutePathMatches('settings/qualification', 'settings/qualification')).toBe(true);
    expect(consoleRoutePathMatches('support/:caseId', 'support/case%3Aone')).toBe(true);
    expect(consoleRoutePathMatches('support/:caseId', 'orders/case%3Aone')).toBe(false);
  });

  it('shares one route load across navigation intent and actual routing', async () => {
    let release: ((value: unknown) => void) | undefined;
    const loader = vi.fn(() => new Promise<unknown>((resolve) => { release = resolve; }));
    const timings: string[] = [];
    const telemetry = createConsoleInteractionTelemetry({
      onRecord: ({ moduleId, actionId, stage }) => timings.push(`${moduleId}:${actionId}:${stage}`),
    });
    const preloader = createConsoleModulePreloader([
      { moduleId: 'orders', routeId: 'orders.index', entry: true, load: loader },
    ], telemetry);

    const intentLoad = preloader.preloadModule('orders', 'navigation.hover');
    const routeLoad = preloader.loadRoute('orders', 'orders.index', loader);

    expect(routeLoad).toBe(intentLoad);
    await Promise.resolve();
    expect(loader).toHaveBeenCalledOnce();
    expect(preloader.hasRoute('orders.index')).toBe(true);
    release?.({ Component: () => null });
    await routeLoad;
    expect(timings).toEqual([
      'orders:navigation.hover:module-load-start',
      'orders:navigation.hover:module-load-complete',
    ]);
  });

  it('keeps modules independent and retries a failed load', async () => {
    const orders = vi.fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValue({ Component: () => null });
    const products = vi.fn().mockResolvedValue({ Component: () => null });
    const preloader = createConsoleModulePreloader([
      { moduleId: 'orders', routeId: 'orders.index', entry: true, load: orders },
      { moduleId: 'products', routeId: 'products.index', entry: true, load: products },
    ]);

    await expect(preloader.preloadModule('orders', 'navigation.focus')).rejects.toThrow('temporary');
    await expect(preloader.preloadModule('products', 'navigation.hover')).resolves.toBeDefined();
    await expect(preloader.preloadModule('orders', 'navigation.pointerdown')).resolves.toBeDefined();
    expect(orders).toHaveBeenCalledTimes(2);
    expect(products).toHaveBeenCalledOnce();
  });

  it('does not substitute a loader outside the current registry', async () => {
    const registered = vi.fn().mockResolvedValue('registered');
    const fixture = vi.fn().mockResolvedValue('fixture');
    const preloader = createConsoleModulePreloader([
      { moduleId: 'orders', routeId: 'orders.index', entry: true, load: registered },
    ]);

    await expect(preloader.loadRoute('orders', 'orders.index', fixture)).resolves.toBe('fixture');
    expect(registered).not.toHaveBeenCalled();
    expect(fixture).toHaveBeenCalledOnce();
  });
});
