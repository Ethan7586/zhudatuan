import { describe, expect, it, vi } from 'vitest';
import { PartnersManageHandler } from '../application/handler/PartnersManageHandler';

describe('PartnersManageHandler', () => {
  it('preserves every contracted lifecycle state and expected version', async () => {
    const savePartner = vi.fn(async (input) => ({
      ...input,
      scope_id: input.scope,
      created_at: '2026-09-03T00:00:00.000Z',
      updated_at: '2026-09-03T00:00:00.000Z',
      qualification: { valid: 0, pending: 0, rejected: 0, expired: 0, nearest_expiry: null },
    }));
    const handler = new PartnersManageHandler({ savePartner } as never);
    await handler.execute({ path: { partnerid: 'supplier:one' }, body: { kind: 'supplier', name: '测试供应商', status: 'terminated' } } as never, context as never);
    expect(savePartner).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'supplier:one', kind: 'supplier', status: 'terminated', expectedVersion: 4 }));
  });
});

const context = {
  expectedVersion: 4,
  transaction: {},
  security: { kind: 'session', access: { actor: { id: 'actor:one' }, membership: { id: 'membership:one' }, scope: { id: 'enterprise:one', kind: 'enterprise', tenant: 'tenant:one', path: [] } } },
};
