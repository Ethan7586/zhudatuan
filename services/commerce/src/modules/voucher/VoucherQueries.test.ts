import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../foundation/application/OperationExecution';
import type { OperationAction } from '../../foundation/application/ModuleOperations';
import { voucherQueries } from './VoucherQueries';

describe('voucher member queries', () => {
  it('restricts storefront redemption history to the current member owner scope', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => ({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] }));
    const actions = voucherQueries({ descendants: vi.fn(async () => []) });
    const action = actions['voucher.redemptions.read'] as OperationAction;
    await action(request(), { query } as never);
    const [sql, values] = query.mock.calls[0]!;
    expect(sql).toContain('voucher.member_id=$3');
    expect(values).toEqual([null, null, 'member:one', true, 51]);
  });
});

function request(): OperationRequest {
  const type = 'voucher.redemptions.read';
  return {
    type,
    input: { path: {}, query: {}, headers: {}, body: undefined, rawBody: '', deadline: Date.now() + 1000, signal: new AbortController().signal },
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'storefront', assurance: { level: 3 } },
        membership: { id: 'membership:one', active: true, accessVersion: 1, permissions: { allows: new Set(['voucher.redemption.read']), denies: new Set() }, scopes: [] },
        organization: 'mall:one',
        scope: { id: 'member:one', kind: 'owner', path: [] },
        accessVersion: 1,
        capabilities: new Set([type]),
        capabilityVersion: 1,
        assurance: { level: 3 },
        trace: 'trace:one',
      },
    },
  };
}
