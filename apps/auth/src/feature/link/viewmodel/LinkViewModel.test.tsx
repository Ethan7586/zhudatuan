// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Dependencies } from '../../../app/Dependencies';
import { useLinkViewModel } from './LinkViewModel';

const session = Object.freeze({ target: 'storefront' as const });
const provider = Object.freeze({ id: 'provider-1', type: 'wechat' as const });

describe('useLinkViewModel', () => {
  it('loads authoritative links and provider catalog concurrently', async () => {
    const dependencies = fixture([]);
    const { result } = renderHook(() => useLinkViewModel(dependencies, session, false));
    expect(result.current.phase).toBe('loading');
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(result.current.available).toEqual([provider]);
    expect(result.current.selected).toBe('provider-1');
  });

  it('starts a link only through the generated command and approved external navigation', async () => {
    const dependencies = fixture([]);
    const { result } = renderHook(() => useLinkViewModel(dependencies, session, false));
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    await act(async () => result.current.create());
    expect(dependencies.createLink.execute).toHaveBeenCalledWith('provider-1', session, expect.any(AbortSignal));
    expect(dependencies.navigation.assignExternal).toHaveBeenCalledWith('https://identity.example.test/authorize');
  });

  it('revokes only through the generated command use case', async () => {
    const link = Object.freeze({ id: 'link-1', provider: 'provider-1', status: 'active' as const, version: 1 });
    const dependencies = fixture([link]);
    const { result } = renderHook(() => useLinkViewModel(dependencies, session, false));
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    act(() => result.current.askRevoke(link));
    await waitFor(() => expect(result.current.pending).toEqual(link));
    await act(async () => result.current.revoke());
    await waitFor(() => expect(result.current.links).toEqual([]));
    expect(dependencies.revokeLink.execute).toHaveBeenCalledWith('link-1', session, expect.any(AbortSignal));
    expect(result.current.notice).toContain('已解除');
  });

  it('does not call authenticated operations for a provider conflict return', () => {
    const dependencies = fixture([]);
    const { result } = renderHook(() => useLinkViewModel(dependencies, session, true));
    expect(result.current.phase).toBe('conflict');
    expect(dependencies.readLinks.execute).not.toHaveBeenCalled();
  });
});

function fixture(links: readonly Readonly<{ id: string; provider: string; status: 'active'; version: number }>[]): Dependencies {
  return {
    readLinks: { execute: vi.fn(async () => ({ links })) },
    providers: { execute: vi.fn(async () => [provider]) },
    createLink: { execute: vi.fn(async () => ({ redirectUrl: 'https://identity.example.test/authorize' })) },
    revokeLink: { execute: vi.fn(async () => undefined) },
    navigation: { assignExternal: vi.fn() },
  } as unknown as Dependencies;
}
