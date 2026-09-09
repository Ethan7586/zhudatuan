// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIdentityActions } from './useIdentityActions';

afterEach(cleanup);

describe('identity action coordination', () => {
  it('turns five immediate login attempts into one request', async () => {
    let resolve!: (value: string) => void;
    const request = vi.fn(async () => new Promise<string>((done) => {
      resolve = done;
    }));
    const success = vi.fn();
    const failure = vi.fn();
    const { result } = renderHook(() => useIdentityActions<'consumer-login'>(), { wrapper: StrictMode });

    act(() => {
      for (let index = 0; index < 5; index += 1) {
        result.current.run('consumer-login', request, { onSuccess: success, onError: failure });
      }
    });
    await act(async () => Promise.resolve());

    expect(request).toHaveBeenCalledTimes(1);
    expect(result.current.isBusy('consumer-login')).toBe(true);
    await act(async () => {
      resolve('ok');
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(success).toHaveBeenCalledOnce();
    expect(failure).not.toHaveBeenCalled();
    expect(result.current.isBusy('consumer-login')).toBe(false);
  });

  it('does not apply a late response after cancellation', async () => {
    let resolve!: (value: string) => void;
    const success = vi.fn();
    const failure = vi.fn();
    const { result } = renderHook(() => useIdentityActions<'consumer-login'>());
    act(() => {
      result.current.run('consumer-login', async () => new Promise<string>((done) => {
        resolve = done;
      }), { onSuccess: success, onError: failure });
    });
    await act(async () => Promise.resolve());
    act(() => result.current.cancel('consumer-login'));
    await act(async () => {
      resolve('late');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(success).not.toHaveBeenCalled();
    expect(failure).not.toHaveBeenCalled();
    expect(result.current.isBusy('consumer-login')).toBe(false);
  });

  it('restores the action after failure and allows an immediate retry', async () => {
    const failure = vi.fn();
    const success = vi.fn();
    const request = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('ok');
    const { result } = renderHook(() => useIdentityActions<'consumer-login'>());

    act(() => {
      result.current.run('consumer-login', request, { onSuccess: success, onError: failure });
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(failure).toHaveBeenCalledOnce();
    expect(result.current.isBusy('consumer-login')).toBe(false);

    act(() => {
      result.current.run('consumer-login', request, { onSuccess: success, onError: failure });
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(success).toHaveBeenCalledWith('ok');
  });

  it('does not update state after the component unmounts', async () => {
    let resolve!: (value: string) => void;
    const success = vi.fn();
    const failure = vi.fn();
    const { result, unmount } = renderHook(() => useIdentityActions<'consumer-login'>());
    act(() => {
      result.current.run('consumer-login', async () => new Promise<string>((done) => {
        resolve = done;
      }), { onSuccess: success, onError: failure });
    });
    await act(async () => Promise.resolve());
    unmount();
    await Promise.resolve();
    resolve('late');
    await Promise.resolve();
    await Promise.resolve();
    expect(success).not.toHaveBeenCalled();
    expect(failure).not.toHaveBeenCalled();
  });

  it('allows unrelated flows to run independently', async () => {
    const pending = new Map<string, () => void>();
    const { result } = renderHook(() => useIdentityActions<'login' | 'code'>());
    act(() => {
      result.current.run('login', async () => new Promise<void>((resolve) => pending.set('login', resolve)), { onSuccess: vi.fn(), onError: vi.fn() });
      result.current.run('code', async () => new Promise<void>((resolve) => pending.set('code', resolve)), { onSuccess: vi.fn(), onError: vi.fn() });
    });
    await act(async () => Promise.resolve());
    expect(result.current.isBusy('login')).toBe(true);
    expect(result.current.isBusy('code')).toBe(true);
    await act(async () => {
      pending.get('code')?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.isBusy('code')).toBe(false);
    expect(result.current.isBusy('login')).toBe(true);
    await act(async () => {
      pending.get('login')?.();
      await Promise.resolve();
      await Promise.resolve();
    });
  });
});
