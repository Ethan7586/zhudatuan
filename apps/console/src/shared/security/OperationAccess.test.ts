import { OP_VOUCHER_CREDENTIALPOOLS_LIST, OP_VOUCHER_SEARCH_READ } from '@shop/contract/ids';
import { describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { assertOperationAccess, canUseOperation } from './OperationAccess';

describe('assertOperationAccess', () => {
  it('requires assurance but not an action proof when the contract has no proof policy', () => {
    expect(() => assertOperationAccess(assertContext, 'identity.providers.test')).not.toThrow();
  });
  it('requires an action-bound proof when declared by the operation contract', () => {
    expect(() => assertOperationAccess(assertContext, 'risk.policies.manage')).toThrow('ACTION_PROOF_REQUIRED');
  });
});

describe('operation access', () => {
  it('rejects a capability outside the operation scope contract', () => {
    expect(canUseOperation(context('mall', 'voucher.credential.read', OP_VOUCHER_CREDENTIALPOOLS_LIST), OP_VOUCHER_CREDENTIALPOOLS_LIST)).toBe(false);
    expect(canUseOperation(context('platform', 'voucher.credential.read', OP_VOUCHER_CREDENTIALPOOLS_LIST), OP_VOUCHER_CREDENTIALPOOLS_LIST)).toBe(true);
  });

  it('keeps operations that explicitly support the current scope', () => {
    expect(canUseOperation(context('mall', 'voucher.search.read', OP_VOUCHER_SEARCH_READ), OP_VOUCHER_SEARCH_READ)).toBe(true);
  });

  it('keeps identity operations resolved against the signed-in principal', () => {
    expect(canUseOperation(context('mall', 'identity.assurance.manage', 'identity.password.verify'), 'identity.password.verify')).toBe(true);
  });
});

const assertScope = { kind: 'mall', id: 'mall:one' } as const;
const assertContext = {
  session: { permissions: ['identity.provider.test', 'risk.manage'], capabilities: ['identity.providers.test', 'risk.policies.manage'], assurance: { level: 3 } },
  scope: assertScope,
} as ConsoleContext;

function context(kind: ConsoleContext['scope']['kind'], permission: string, capability: string): ConsoleContext {
  const scope = { kind, id: `${kind}:one`, name: '测试范围' } as const;
  return {
    session: {
      actor: 'actor:one',
      membership: 'membership:one',
      accessVersion: 1,
      permissions: [permission],
      capabilities: [capability],
      target: 'console',
      scope,
      scopes: [scope],
      assurance: { level: 3 },
      security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
      syncedAt: '2026-09-11T00:00:00.000Z',
    },
    profile: { display_name: '测试用户', employee_no: null },
    scope,
    scopes: [scope],
  };
}
