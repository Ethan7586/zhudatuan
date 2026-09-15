import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { SupportPortFactory } from '../../01_public_gongkai/SupportPort';
import { assignTicketOperations } from '../../03_application_yingyong/command/AssignTicket';
import { closeTicketOperations } from '../../03_application_yingyong/command/CloseTicket';

describe('support lifecycle management', () => {
  it('transfers a ticket with optimistic concurrency and records the target agent', async () => {
    const history = vi.fn();
    const ports = (() => ({ history })) as unknown as SupportPortFactory;
    const action = assignTicketOperations(ports)['support.assignments.manage'];
    if (typeof action !== 'function') throw new Error('SUPPORT_ASSIGNMENT_ACTION_MISSING');
    const query = vi.fn()
      .mockResolvedValueOnce(rows([{ scope_id: 'mall:one', conversation_id: 'conversation:one', member_id: null, version: 4 }]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([{ id: 'assignment:new', ticket_id: 'case:one', agent_id: 'agent:next' }]))
      .mockResolvedValueOnce(rows([{ id: 'case:one' }]));

    await action(assignmentRequest(4), { query } as unknown as OperationDatabase);

    expect(String(query.mock.calls[0]?.[0])).toContain('for update of ticket');
    expect(String(query.mock.calls[3]?.[0])).toContain('and version=$3 returning id');
    expect(history).toHaveBeenCalledWith('case:one', 'mall:one', 'assigned', 'actor:operator',
      expect.objectContaining({ agent: 'agent:next', reason: 'manual-transfer' }));
  });

  it('rejects a stale transfer before releasing the current assignment', async () => {
    const ports = (() => ({ history: vi.fn() })) as unknown as SupportPortFactory;
    const action = assignTicketOperations(ports)['support.assignments.manage'];
    if (typeof action !== 'function') throw new Error('SUPPORT_ASSIGNMENT_ACTION_MISSING');
    const query = vi.fn().mockResolvedValueOnce(rows([{ scope_id: 'mall:one', conversation_id: 'conversation:one',
      member_id: null, version: 5 }]));

    await expect(action(assignmentRequest(4), { query } as unknown as OperationDatabase)).rejects.toThrow('VERSION_CONFLICT');
    expect(query).toHaveBeenCalledOnce();
  });

  it('creates one durable platform escalation and writes history', async () => {
    const history = vi.fn();
    const ports = (() => ({ history })) as unknown as SupportPortFactory;
    const action = closeTicketOperations(ports)['support.cases.update'];
    if (typeof action !== 'function') throw new Error('SUPPORT_CASE_UPDATE_MISSING');
    const current = ticket('open', 4);
    const query = vi.fn().mockResolvedValueOnce(rows([current]))
      .mockResolvedValueOnce(rows([{ ...current, state: 'waiting', version: 5 }]))
      .mockResolvedValueOnce(rows([{ id: 'escalation:new' }]));

    const result = await action(caseRequest('support.cases.update', 4, { escalation: 'platform' }),
      { query } as unknown as OperationDatabase);

    expect(result.body).toMatchObject({ state: 'waiting', version: 5 });
    expect(String(query.mock.calls[2]?.[0])).toContain("'manual-platform'");
    expect(history).toHaveBeenCalledWith('case:one', 'mall:one', 'platform.escalated', 'actor:operator',
      expect.objectContaining({ target: 'platform', state: 'waiting' }));
  });

  it('closes only a resolved ticket at the exact reviewed version', async () => {
    const history = vi.fn();
    const ports = (() => ({ history })) as unknown as SupportPortFactory;
    const action = closeTicketOperations(ports)['support.cases.close'];
    if (typeof action !== 'function') throw new Error('SUPPORT_CASE_CLOSE_MISSING');
    const current = ticket('resolved', 8);
    const query = vi.fn().mockResolvedValueOnce(rows([current])).mockResolvedValueOnce(rows([{ ...current, state: 'closed', version: 9 }]));

    const result = await action(caseRequest('support.cases.close', 8, {}), { query } as unknown as OperationDatabase);

    expect(result.body).toMatchObject({ state: 'closed', version: 9 });
    expect(history).toHaveBeenCalledWith('case:one', 'mall:one', 'closed', 'actor:operator', {});
  });
});

function assignmentRequest(expectedVersion: number): OperationRequest {
  return { type: 'support.assignments.manage', access: access(), input: { path: { assignmentid: 'assignment:new' }, query: {},
    body: { case: 'case:one', agent: 'agent:next', reason: 'manual-transfer' }, expectedVersion } } as unknown as OperationRequest;
}

function caseRequest(type: 'support.cases.update' | 'support.cases.close', expectedVersion: number,
  body: Readonly<Record<string, unknown>>): OperationRequest {
  return { type, access: access(), input: { path: { caseid: 'case:one' }, query: {}, body, expectedVersion } } as unknown as OperationRequest;
}

function access() {
  return { membership: { id: 'membership:operator' }, scope: { id: 'mall:one' },
    actor: { id: 'actor:operator', target: 'console' }, trace: 'trace:lifecycle' };
}

function ticket(state: string, version: number) {
  return { id: 'case:one', conversation_id: 'conversation:one', scope_id: 'mall:one', priority: 'normal', state, version };
}

function rows(value: readonly Record<string, unknown>[]) {
  return { rows: value, rowCount: value.length, command: '', oid: 0, fields: [] };
}
