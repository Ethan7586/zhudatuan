import { describe, expect, it, vi } from 'vitest';
import { ManageAssignment } from './ManageAssignment';

const actor = { actor: 'actor:manager', membership: 'membership:manager', member: 'member:manager', target: 'console', scope: 'mall:one', scopes: ['mall:one'], trace: 'trace:one' } as const;
const ticket = { id: 'ticket:one', conversation: 'conversation:one', scope: 'mall:one', skill: 'vip', priority: 'high', state: 'open', version: 4, member: 'member:one' } as const;

describe('ManageAssignment', () => {
  it('checks the locked version and appends history plus an outbox fact', async () => {
    const assignments = { lockTicket: vi.fn(async () => ticket), assign: vi.fn(async () => ({ id: 'assignment:one', ticket_id: 'ticket:one', agent_id: 'agent:one', reason: '技能升级转派', assigned_at: '2026-09-02T00:00:00.000Z', released_at: null, scope_id: 'mall:one' })) };
    const events = { history: vi.fn(), append: vi.fn() };
    const service = new ManageAssignment({ actor: vi.fn(async () => actor) } as never, assignments as never, events as never);
    const response = await service.manageAssignment({} as never, { path: { assignmentid: 'assignment:one' }, body: { case: 'ticket:one', agent: 'agent:one', reason: '技能升级转派' } } as never, { expectedVersion: 4, traceId: 'trace:one' } as never);
    expect(response.headers?.etag).toBe('"5"');
    expect(assignments.assign).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ ticket, expectedVersion: 4 }));
    expect(events.history).toHaveBeenCalledOnce();
    expect(events.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'support.ticket.assigned' }));
  });

  it('rejects concurrent transfer on a stale ticket', async () => {
    const assignments = { lockTicket: vi.fn(async () => ticket), assign: vi.fn() };
    const service = new ManageAssignment({ actor: vi.fn(async () => actor) } as never, assignments as never, { history: vi.fn(), append: vi.fn() } as never);
    await expect(service.manageAssignment({} as never, { path: { assignmentid: 'assignment:two' }, body: { case: 'ticket:one', agent: 'agent:two', reason: '并发转派测试' } } as never, { expectedVersion: 3, traceId: 'trace:one' } as never)).rejects.toThrow('VERSION_CONFLICT');
    expect(assignments.assign).not.toHaveBeenCalled();
  });
});
