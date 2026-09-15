import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { SupportPortFactory } from '../../01_public_gongkai/SupportPort';
import { closeTicketOperations } from '../../03_application_yingyong/command/CloseTicket';

describe('support priority review', () => {
  it('requires the reviewed version, recalculates SLA and writes one audit history entry', async () => {
    const enqueue = vi.fn(); const history = vi.fn();
    const ports = (() => ({ sla: async () => ({ response: 300, resolution: 3600 }), enqueue, history })) as unknown as SupportPortFactory;
    const action = closeTicketOperations(ports)['support.cases.update'];
    if (typeof action !== 'function') throw new Error('SUPPORT_CASE_UPDATE_MISSING');
    const current = { id: 'case:one', conversation_id: 'conversation:one', scope_id: 'mall:one', priority: 'normal',
      state: 'open', version: 4 };
    const updated = { ...current, priority: 'urgent', version: 5, response_due_at: '2026-09-16T00:05:00Z',
      resolution_due_at: '2026-09-16T01:00:00Z' };
    const query = vi.fn().mockResolvedValueOnce({ rows: [current], rowCount: 1 }).mockResolvedValueOnce({ rows: [updated], rowCount: 1 });

    const result = await action(request(4), { query } as unknown as OperationDatabase);

    expect(result.body).toMatchObject({ priority: 'urgent', version: 5 });
    expect(String(query.mock.calls[1]?.[0])).toContain('make_interval');
    expect(history).toHaveBeenCalledWith('case:one', 'mall:one', 'priority.reviewed', 'actor:reviewer',
      expect.objectContaining({ priority: 'urgent', previousPriority: 'normal' }));
    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it('rejects a stale reviewer before changing the ticket', async () => {
    const ports = (() => ({})) as unknown as SupportPortFactory;
    const action = closeTicketOperations(ports)['support.cases.update'];
    if (typeof action !== 'function') throw new Error('SUPPORT_CASE_UPDATE_MISSING');
    const query = vi.fn().mockResolvedValueOnce({ rows: [{ id: 'case:one', conversation_id: 'conversation:one', scope_id: 'mall:one',
      priority: 'normal', state: 'open', version: 5 }], rowCount: 1 });

    await expect(action(request(4), { query } as unknown as OperationDatabase)).rejects.toThrow('VERSION_CONFLICT');
    expect(query).toHaveBeenCalledOnce();
  });
});

function request(expectedVersion: number): OperationRequest {
  return { type: 'support.cases.update', access: { membership: { id: 'membership:reviewer' }, scope: { id: 'mall:one' },
    actor: { id: 'actor:reviewer', target: 'console' }, trace: 'trace:review' }, input: { path: { caseid: 'case:one' }, query: {},
      body: { priority: 'urgent' }, expectedVersion } } as unknown as OperationRequest;
}
