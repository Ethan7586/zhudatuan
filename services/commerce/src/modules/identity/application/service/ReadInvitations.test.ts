import { describe, expect, it, vi } from 'vitest';
import { ReadInvitations } from './ReadInvitations';

describe('ReadInvitations', () => {
  it('composes invitation accounts through bounded public ports without N+1 reads', async () => {
    const read = vi.fn(async () => [record()]);
    const summaries = vi.fn(async () => [
      { membership: 'membership:employee', member: 'member:employee', employeeNo: 'E1002' },
      { membership: 'membership:owner', member: 'member:owner', employeeNo: 'E1001' },
    ]);
    const profiles = vi.fn(async () => [
      { member: 'member:employee', displayName: '李小明', mobileMasked: '139****0002' },
      { member: 'member:owner', displayName: '王主管', mobileMasked: '138****0001' },
    ]);
    const action = new ReadInvitations({ read } as never, { summaries } as never, { profiles } as never).action();

    const response = await action(request(), {} as never);

    expect((response.body as Readonly<{ items: readonly Readonly<Record<string, unknown>>[] }>).items[0]).toMatchObject({
      recipient_display_name: '李小明',
      recipient_employee_no: 'E1002',
      recipient_mobile_masked: '139****0002',
      issuer_display_name: '王主管',
      issuer_employee_no: 'E1001',
      issuer_mobile_masked: '138****0001',
    });
    expect(summaries).toHaveBeenCalledOnce();
    expect(profiles).toHaveBeenCalledOnce();
  });
});

function record() {
  return {
    id: 'invitation:one',
    kind: 'enrollment',
    target: 'storefront',
    organization_id: 'mall:one',
    membership_id: 'membership:employee',
    issuer_membership_id: 'membership:owner',
    issuer_access_version: 3,
    minimum_assurance: 2,
    max_uses: 1,
    use_count: 0,
    not_before: '2026-09-03T00:00:00.000Z',
    expires_at: '2026-09-06T00:00:00.000Z',
    status: 'active',
    reason: '新员工入职',
    created_at: '2026-09-03T00:00:00.000Z',
    revoked_at: null,
    revoked_by: null,
    revoke_reason: null,
    version: 1,
  } as const;
}

function request() {
  return {
    type: 'identity.invitations.read',
    security: { kind: 'session', access: { membership: { id: 'membership:owner' }, scope: { id: 'mall:one' }, assurance: { level: 2 }, trace: 'trace:one' } },
    input: { path: {}, query: {}, headers: {}, body: {}, rawBody: '', deadline: Date.now() + 1_000, signal: new AbortController().signal },
  } as never;
}
