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
    const createLink = vi.spyOn(dependencies.createLink, 'execute');
    const assignExternal = vi.spyOn(dependencies.navigation, 'assignExternal');
    const { result } = renderHook(() => useLinkViewModel(dependencies, session, false));
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    act(() => result.current.create());
    await waitFor(() => expect(createLink).toHaveBeenCalledWith('provider-1', session, expect.any(AbortSignal)));
    expect(assignExternal).toHaveBeenCalledWith('https://identity.example.test/authorize');
  });

  it('revokes only through the generated command use case', async () => {
    const link = Object.freeze({ id: 'link-1', provider: 'provider-1', status: 'active' as const, version: 1 });
    const dependencies = fixture([link]);
    const revokeLink = vi.spyOn(dependencies.revokeLink, 'execute');
    const { result } = renderHook(() => useLinkViewModel(dependencies, session, false));
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    act(() => result.current.askRevoke(link));
    await waitFor(() => expect(result.current.pending).toEqual(link));
    act(() => result.current.revoke());
    await waitFor(() => expect(result.current.links).toEqual([]));
    expect(revokeLink).toHaveBeenCalledWith('link-1', session, expect.any(AbortSignal));
    expect(result.current.notice).toContain('已解除');
  });

  it('does not call authenticated operations for a provider conflict return', () => {
    const dependencies = fixture([]);
    const readLinks = vi.spyOn(dependencies.readLinks, 'execute');
    const { result } = renderHook(() => useLinkViewModel(dependencies, session, true));
    expect(result.current.phase).toBe('conflict');
    expect(readLinks).not.toHaveBeenCalled();
  });
});

function fixture(links: readonly Readonly<{ id: string; provider: string; status: 'active'; version: number }>[]): Dependencies {
  return {
    readLinks: { execute: vi.fn(() => Promise.resolve({ links })) },
    providers: { execute: vi.fn(() => Promise.resolve([provider])) },
    createLink: { execute: vi.fn(() => Promise.resolve({ redirectUrl: 'https://identity.example.test/authorize' })) },
    revokeLink: { execute: vi.fn(() => Promise.resolve()) },
    navigation: { assignExternal: vi.fn() },
  } as unknown as Dependencies;
}
