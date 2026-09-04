import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReadLink } from '../application/ReadLink';
import { useLinkViewModel } from './LinkViewModel';

describe('useLinkViewModel', () => {
  it('moves from loading to empty for an authoritative empty result', async () => {
    const reader = { execute: () => Promise.resolve({ links: [] }) } as unknown as ReadLink;
    const { result } = renderHook(() => useLinkViewModel(reader, 'storefront'));
    expect(result.current.kind).toBe('loading');
    await waitFor(() => expect(result.current.kind).toBe('empty'));
  });
});
