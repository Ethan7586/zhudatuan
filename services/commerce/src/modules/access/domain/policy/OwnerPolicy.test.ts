import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../platform/error/DomainError';
import { OwnerPolicy, type OwnerTransferState } from './OwnerPolicy';

const valid: OwnerTransferState = {
  actorMembership: 'membership:old',
  currentMembership: 'membership:old',
  targetMembership: 'membership:new',
  scope: 'tenant:one',
  currentOrganization: 'tenant:one',
  targetOrganization: 'tenant:one',
  currentClient: 'console',
  targetClient: 'console',
  currentStatus: 'active',
  targetStatus: 'active',
  roleKind: 'owner',
  currentVersion: 4,
  expectedCurrentVersion: 4,
  targetVersion: 7,
  expectedTargetVersion: 7,
};

describe('OwnerPolicy', () => {
  it('allows intrinsic system roles through the ordinary delegation permission and scope checks', () => {
    expect(() => new OwnerPolicy().assertDelegatable(['system', 'custom'])).not.toThrow();
  });

  it('routes owner roles exclusively through owner transfer', () => {
    expect(() => new OwnerPolicy().assertDelegatable(['custom', 'owner'])).toThrowError(expect.objectContaining<Partial<DomainError>>({ code: 'OWNER_TRANSFER_REQUIRED' }));
  });

  it('accepts only a current-owner transfer to another active console membership in the same scope', () => {
    expect(() => new OwnerPolicy().assertTransfer(valid)).not.toThrow();
  });

  it.each([{ actorMembership: 'membership:other' }, { targetMembership: 'membership:old' }, { targetOrganization: 'tenant:other' }, { targetClient: 'storefront' as const }, { targetStatus: 'suspended' }, { roleKind: 'custom' }])(
    'rejects owner bypass %#',
    (override) => {
      expect(() => new OwnerPolicy().assertTransfer({ ...valid, ...override })).toThrowError(expect.objectContaining<Partial<DomainError>>({ code: 'OWNER_TRANSFER_REQUIRED' }));
    }
  );

  it('rejects either stale membership version', () => {
    expect(() => new OwnerPolicy().assertTransfer({ ...valid, expectedTargetVersion: 6 })).toThrowError(expect.objectContaining<Partial<DomainError>>({ code: 'VERSION_CONFLICT' }));
  });
});
