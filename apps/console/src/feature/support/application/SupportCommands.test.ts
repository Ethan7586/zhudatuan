import type { OperationId } from '@shop/contract';
import { OP_SUPPORT_ACCOUNTS_MANAGE, OP_SUPPORT_AGENTS_MANAGE, OP_SUPPORT_ASSIGNMENTS_MANAGE, OP_SUPPORT_CASES_CLOSE, OP_SUPPORT_CASES_REOPEN } from '@shop/contract/ids';
import { operationPolicy } from '@shop/contract/policies';
import { describe, expect, it, vi } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { SupportPort } from '../public';
import type { Ticket } from '../model/Ticket';
import { AssignTicket } from './AssignTicket';
import { CloseTicket } from './CloseTicket';
import { ManageSupportConfig } from './ManageSupportConfig';
import { ReopenTicket } from './ReopenTicket';

describe('support command access', () => {
  it('fails closed before invoking a command that is not granted', () => {
    const { gateway, calls } = port();
    expect(() => new CloseTicket(gateway).execute(context([]), ticket())).toThrow('OPERATION_ACCESS_DENIED');
    expect(calls.close).not.toHaveBeenCalled();
  });

  it('requires the catalog assurance and CSRF before assignment, close and reopen', async () => {
    const { gateway, calls } = port();
    const operations = [OP_SUPPORT_ASSIGNMENTS_MANAGE, OP_SUPPORT_CASES_CLOSE, OP_SUPPORT_CASES_REOPEN];
    expect(() => new AssignTicket(gateway).execute(context(operations, 1), ticket(), 'agent:two', '技能组重新分配')).toThrow('STEPUP_REQUIRED');
    expect(() => new CloseTicket(gateway).execute(context(operations, 2, false), ticket())).toThrow('安全会话已过期');

    await new AssignTicket(gateway).execute(context(operations, 2), ticket(), 'agent:two', '技能组重新分配');
    await new CloseTicket(gateway).execute(context(operations, 2), ticket());
    await new ReopenTicket(gateway).execute(context(operations, 2), ticket());
    expect(calls.assign).toHaveBeenCalledOnce();
    expect(calls.close).toHaveBeenCalledOnce();
    expect(calls.reopen).toHaveBeenCalledOnce();
  });

  it('uses MFA for agent management and step-up for channel account management', async () => {
    const { gateway, calls } = port();
    const manager = new ManageSupportConfig(gateway);
    const granted = [OP_SUPPORT_AGENTS_MANAGE, OP_SUPPORT_ACCOUNTS_MANAGE];
    await manager.agent(context(granted, 2), 'agent:one', 3, { membership: 'membership:one', skills: ['refund'], capacity: 5, state: 'available' });
    expect(() => manager.account(context(granted, 2), 'account:one', 3, { provider: 'inapp', displayName: '在线客服', state: 'active' })).toThrow('STEPUP_REQUIRED');
    await manager.account(context(granted, 3), 'account:one', 3, { provider: 'inapp', displayName: '在线客服', state: 'active' });
    expect(calls.manageAgent).toHaveBeenCalledOnce();
    expect(calls.manageAccount).toHaveBeenCalledOnce();
  });
});

function port() {
  const calls = {
    assign: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    reopen: vi.fn().mockResolvedValue(undefined),
    manageAgent: vi.fn().mockResolvedValue(undefined),
    manageAccount: vi.fn().mockResolvedValue(undefined),
  };
  return { gateway: calls as unknown as SupportPort, calls };
}

function context(operations: readonly OperationId[], level = 3, csrf = true): ConsoleContext {
  const scope = { kind: 'mall' as const, id: 'mall:one' };
  const policies = operations.map(operationPolicy);
  return {
    session: {
      actor: 'actor:support',
      membership: 'membership:support',
      accessVersion: 7,
      permissions: [...new Set(policies.flatMap(({ permission }) => (permission ? [permission] : [])))],
      capabilities: [...new Set(policies.map(({ capability }) => capability))],
      assurance: { level },
      security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
      ...(csrf ? { csrf: 'csrf:support:1234' } : {}),
      target: 'console',
      syncedAt: '2026-09-04T00:00:00.000Z',
      scope,
      scopes: [scope],
    },
    profile: { display_name: '测试客服', employee_no: null },
    scope,
    scopes: [scope],
  };
}

function ticket(): Ticket {
  return {
    id: 'case:one',
    priority: 'high',
    state: 'assigned',
    assignedAgentId: 'agent:one',
    responseDueAt: '2026-09-04T01:00:00.000Z',
    resolutionDueAt: '2026-09-04T08:00:00.000Z',
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:30:00.000Z',
    version: 3,
    conversationId: 'conversation:one',
    skill: 'refund',
    memberId: 'member:one',
    orderId: 'order:one',
    channel: 'inapp',
    subject: '订单退款咨询',
    referenceType: 'order',
    referenceId: 'order:one',
    unreadCount: 1,
    slaRisk: 'risk',
  };
}
