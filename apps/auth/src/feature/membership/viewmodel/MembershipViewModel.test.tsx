// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Dependencies } from '../../../app/Dependencies';
import { useMembershipViewModel } from './MembershipViewModel';

describe('useMembershipViewModel', () => {
  it('publishes the authoritative membership list after loading', async () => {
    const membership = Object.freeze({ id: 'membership:1', target: 'storefront' as const, displayName: '张三', organizationName: '示例企业', scopeKind: 'mall', scopeId: 'mall:1', roleLabel: '会员' });
    const dependencies = { memberships: { execute: () => Promise.resolve({ memberships: [membership] }) } } as unknown as Dependencies;
    const { result } = renderHook(() => useMembershipViewModel(dependencies, { target: 'storefront', returnPath: '/orders' }));
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.memberships).toEqual([membership]);
  });
});
