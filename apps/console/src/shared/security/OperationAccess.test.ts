import { describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { assertOperationAccess } from './OperationAccess';

describe('assertOperationAccess', () => {
  it('requires assurance but not an action proof when the contract has no proof policy', () => {
    expect(() => assertOperationAccess(context, 'identity.providers.test')).not.toThrow();
  });
  it('requires an action-bound proof when declared by the operation contract', () => {
    expect(() => assertOperationAccess(context, 'risk.policies.manage')).toThrow('ACTION_PROOF_REQUIRED');
  });
});
const scope = { kind: 'mall', id: 'mall:one' } as const;
const context = { session: { permissions: ['identity.provider.test', 'risk.manage'], capabilities: ['identity.providers.test', 'risk.policies.manage'], assurance: { level: 3 } }, scope } as ConsoleContext;
