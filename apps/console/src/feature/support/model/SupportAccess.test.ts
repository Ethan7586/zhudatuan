import { SUPPORT_OPERATION_IDS, OP_ORDER_DETAIL_READ, OP_SUPPORT_ACCOUNTS_MANAGE, OP_SUPPORT_CASES_CLOSE } from '@shop/contract/ids';
import type { OperationId } from '@shop/contract';
import { operationPolicy } from '@shop/contract/policies';
import { describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { supportAccess } from './SupportAccess';

describe('supportAccess', () => {
  it('keeps mutation, settings and cross-domain controls out of a queue-only session', () => {
    const access = supportAccess(context(['support.cases.read', 'support.messages.read', 'support.events.read']));

    expect(access).toMatchObject({ settings: false, upload: false, assign: false, assignmentReady: false, close: false, reopen: false, history: false, order: false, realtime: true });
  });

  it('separates an operation grant from its current assurance requirement', () => {
    const access = supportAccess(context([...SUPPORT_OPERATION_IDS, OP_ORDER_DETAIL_READ], 1));

    expect(access).toMatchObject({ settings: true, upload: true, assign: true, assignmentReady: false, close: true, reopen: true, history: true, order: true, realtime: true });
    expect(access.verify(OP_SUPPORT_CASES_CLOSE)).toBe(false);
    expect(access.verify(OP_SUPPORT_ACCOUNTS_MANAGE)).toBe(false);
  });

  it('unlocks MFA work without incorrectly unlocking step-up configuration', () => {
    const access = supportAccess(context([...SUPPORT_OPERATION_IDS], 2));

    expect(access.assignmentReady).toBe(true);
    expect(access.verify(OP_SUPPORT_CASES_CLOSE)).toBe(true);
    expect(access.verify(OP_SUPPORT_ACCOUNTS_MANAGE)).toBe(false);
  });
});

function context(operations: readonly OperationId[], level = 3): ConsoleContext {
  const scope = { kind: 'mall' as const, id: 'mall:one', name: '测试商城' };
  const policies = operations.map(operationPolicy);
  return {
    session: {
      actor: 'actor:support', membership: 'membership:support', accessVersion: 7,
      permissions: [...new Set(policies.flatMap(({ permission }) => permission ? [permission] : []))],
      capabilities: [...new Set(policies.map(({ capability }) => capability))], assurance: { level },
      security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: null },
      csrf: 'csrf:support:1234', target: 'console', syncedAt: '2026-09-04T00:00:00.000Z', scope, scopes: [scope],
    },
    profile: { display_name: '测试客服', employee_no: null }, scope, scopes: [scope],
  };
}
