import { describe, expect, it, vi } from 'vitest';
import { homeViewModel } from '../miniprogram/feature/home/viewmodel/HomeViewModel';
import { registerFeaturePage } from '../miniprogram/shell/Page';

describe('miniapp page controller', () => {
  it('loads a configured route through the runtime and publishes an understandable state', async () => {
    let definition: Record<string, unknown> | undefined;
    const setNavigationBarTitle = vi.fn();
    const runtime = {
      read: vi.fn(async () => ({
        title: '今日福利',
        description: '精选福利一屏掌握。',
        data: { rows: [{ key: 'one', title: '节日福利', detail: '企业福利', status: '可使用', timestamp: '' }], count: 1, nextCursor: null },
        authenticated: true,
        stale: false,
        actions: [],
        navigation: [],
      })),
      failure: vi.fn(() => ({ message: '安全提示', authenticationRequired: false })),
    };
    Object.assign(globalThis, {
      Page: (value: Record<string, unknown>) => { definition = value; },
      getApp: () => ({ runtime }),
      wx: { setNavigationBarTitle, stopPullDownRefresh: vi.fn(), redirectTo: vi.fn(), navigateTo: vi.fn() },
    });
    registerFeaturePage(homeViewModel);
    const state: Record<string, unknown> = {};
    const instance = {
      setData: (value: Record<string, unknown>) => Object.assign(state, value),
      ...(definition as object),
    } as Record<string, unknown>;
    const onLoad = definition?.onLoad as ((this: Record<string, unknown>, options: Record<string, string>) => void) | undefined;
    expect(onLoad).toBeTypeOf('function');
    onLoad!.call(instance, {});
    await vi.waitFor(() => expect(state.state).toBe('success'));
    expect(runtime.read).toHaveBeenCalledWith(homeViewModel, expect.objectContaining({ id: 'miniapphome' }), expect.any(AbortSignal));
    expect(state).toMatchObject({ title: '今日福利', authenticated: true, count: 1 });
    expect(setNavigationBarTitle).toHaveBeenCalledWith({ title: '今日福利' });
  });
});
