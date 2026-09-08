// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@shop/sdk';
import type { StorefrontSession } from '../../../entity/session';
import type { Voucher } from '../model/Voucher';
import { useActivationViewModel } from './ActivationViewModel';

const state = vi.hoisted(() => ({ session: null as StorefrontSession | null, activate: vi.fn(), toast: vi.fn() }));
vi.mock('../../../app/DependencyContext', () => ({ useDependencies: () => ({ voucher: { activate: state.activate } }) }));
vi.mock('../../../entity/session/viewmodel/SessionContext', () => ({ useSession: () => ({ session: state.session, showToast: state.toast }) }));
const voucher = { id: 'voucher:one', productName: '节日福利', state: 'active' } as Voucher;
beforeEach(() => {
  state.activate.mockReset();
  state.toast.mockReset();
  state.session = { membership: 'member:one', scope: { kind: 'mall', id: 'mall:one' }, accessVersion: 1, csrfToken: 'csrf:one' };
});
afterEach(cleanup);

describe('activation command state', () => {
  it('normalizes the card number, keeps secret case, clears the form and returns the real voucher', async () => {
    state.activate.mockResolvedValue(voucher);
    const done = vi.fn();
    const { result } = renderHook(() => useActivationViewModel(done, vi.fn()));
    act(() => {
      result.current.actions.open();
      result.current.actions.number('vc001234');
      result.current.actions.secret('Secret123');
    });
    const key = result.current.draft!.key;
    await act(() => result.current.actions.submit());
    expect(state.activate).toHaveBeenCalledWith(state.session, { mode: 'numbersecret', number: 'VC001234', secret: 'Secret123' }, key, expect.any(AbortSignal));
    expect(result.current.draft).toBeNull();
    expect(done).toHaveBeenCalledExactlyOnceWith(voucher);
  });

  it('blocks duplicate submits and reuses the idempotency key for the unchanged failed command', async () => {
    let reject!: (cause: Error) => void;
    state.activate.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        })
    );
    const { result } = renderHook(() => useActivationViewModel(vi.fn(), vi.fn()));
    act(() => {
      result.current.actions.open();
      result.current.actions.mode('secret');
      result.current.actions.secret('Secret123');
    });
    const key = result.current.draft!.key;
    let first!: Promise<void>;
    act(() => {
      first = result.current.actions.submit();
      void result.current.actions.submit();
    });
    expect(state.activate).toHaveBeenCalledTimes(1);
    act(() => result.current.actions.close());
    expect(result.current.draft).not.toBeNull();
    await act(async () => {
      reject(new Error('CONNECTION_FAILED'));
      await first;
    });
    expect(result.current.busy).toBe(false);
    state.activate.mockResolvedValueOnce(voucher);
    await act(() => result.current.actions.submit());
    expect(state.activate.mock.calls.map((call) => call[2])).toEqual([key, key]);
    expect(state.activate.mock.calls[1]?.[1]).toEqual({ mode: 'secret', secret: 'Secret123' });
  });

  it('clears credentials when changing mode and assigns a new key after an edit', () => {
    const { result } = renderHook(() => useActivationViewModel(vi.fn(), vi.fn()));
    act(() => {
      result.current.actions.open();
      result.current.actions.number('VC001234');
      result.current.actions.secret('Secret123');
    });
    const key = result.current.draft!.key;
    act(() => result.current.actions.mode('secret'));
    expect(result.current.draft).toMatchObject({ mode: 'secret', number: '', secret: '' });
    expect(result.current.draft?.key).not.toBe(key);
    act(() => result.current.actions.close());
    expect(result.current.draft).toBeNull();
  });

  it('keeps the unchanged command ready for an automatic retry after step-up', async () => {
    const verify = vi.fn();
    state.activate.mockRejectedValueOnce(new ApiError('STEPUP_REQUIRED', 403, 'request:one')).mockResolvedValueOnce(voucher);
    const { result } = renderHook(() => useActivationViewModel(vi.fn(), verify));
    act(() => {
      result.current.actions.open();
      result.current.actions.mode('secret');
      result.current.actions.secret('Secret123');
    });
    const key = result.current.draft!.key;
    await act(() => result.current.actions.submit());
    expect(verify).toHaveBeenCalledOnce();
    expect(result.current.draft?.key).toBe(key);
    await act(() => result.current.actions.submit());
    expect(state.activate.mock.calls.map((call) => call[2])).toEqual([key, key]);
    expect(result.current.draft).toBeNull();
  });

  it('aborts on scope change and ignores a late successful response from the old account', async () => {
    let resolve!: (value: Voucher) => void;
    state.activate.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const done = vi.fn();
    const { result, rerender } = renderHook(() => useActivationViewModel(done, vi.fn()));
    act(() => {
      result.current.actions.open();
      result.current.actions.mode('secret');
      result.current.actions.secret('Secret123');
    });
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.actions.submit();
    });
    const signal = state.activate.mock.calls[0]?.[3] as AbortSignal;
    state.session = { ...state.session!, membership: 'member:other', scope: { kind: 'mall', id: 'mall:other' } };
    rerender();
    expect(signal.aborted).toBe(true);
    expect(result.current.draft).toBeNull();
    await act(async () => {
      resolve(voucher);
      await pending;
    });
    expect(done).not.toHaveBeenCalled();
    expect(state.toast).not.toHaveBeenCalled();
  });
});
