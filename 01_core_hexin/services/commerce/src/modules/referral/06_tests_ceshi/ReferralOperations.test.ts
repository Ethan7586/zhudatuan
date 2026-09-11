import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import type { OperationAction, OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { allocateWithdrawal, referralOperationActions } from '../03_application_yingyong/ReferralOperations';

describe('referral operations', () => {
  it('rejects rates above the shared basis-point ceiling before reading the catalog', async () => {
    const query = vi.fn();
    await expect(action('referral.products.manage')(operatorRequest('referral.products.manage', { sku: 'sku:one', commissionBps: 8000, rewardBps: 3000, enabled: true }, 0), { query } as unknown as OperationDatabase)).rejects.toThrow(
      'REFERRAL_RATE_INVALID'
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('requires an optimistic version for setting writes', async () => {
    const query = vi.fn();
    await expect(
      action('referral.settings.manage')(
        operatorRequest('referral.settings.manage', {
          enabled: true,
          recruitEnabled: true,
          reviewRequired: true,
          rewardEnabled: false,
          bindingMode: 'permanent',
          settleTrigger: 'on_paid',
          settleDelayDays: 0,
          withdrawMinMinor: 100,
          withdrawMonthlyMax: 10,
        }),
        { query } as unknown as OperationDatabase
      )
    ).rejects.toThrow('EXPECTED_VERSION_REQUIRED');
    expect(query).not.toHaveBeenCalled();
  });

  it('delegates first-touch conflict handling to the locked database function and returns the winner', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce(result([{ member: 'member:customer', scope: 'mall:one' }]))
      .mockResolvedValueOnce(
        result([
          {
            binding_id: 'binding:first',
            winner_referral_member_id: 'referral-member:first',
            created: false,
            bound_at: '2026-08-29T01:00:00Z',
            expires_at: null,
          },
        ])
      );
    const response = await action('referral.bindings.create')(memberRequest('referral.bindings.create', { referralMember: 'referral-member:later' }), { query } as unknown as OperationDatabase);

    expect(String(query.mock.calls[1]?.[0])).toContain('referral.bind_first_touch');
    expect(query.mock.calls[1]?.[1]).toEqual([expect.stringMatching(/^referral-binding:/), 'mall:one', 'member:customer', 'referral-member:later']);
    expect(response).toMatchObject({
      status: 200,
      body: { winner_referral_member_id: 'referral-member:first', candidate_won: false },
    });
  });

  it('stores only the immediate inviter and performs no ancestry walk during application', async () => {
    const inserted = {
      id: 'referral-member:new',
      scope_id: 'mall:one',
      member_id: 'member:customer',
      inviter_member_id: 'referral-member:parent',
      state: 'pending',
      version: 0,
    };
    const query = vi
      .fn()
      .mockResolvedValueOnce(result([{ member: 'member:customer', scope: 'mall:one' }]))
      .mockResolvedValueOnce(result([]))
      .mockResolvedValueOnce(result([{ review_required: true }]))
      .mockResolvedValueOnce(result([{ eligible: 1 }]))
      .mockResolvedValueOnce(result([inserted]));

    const response = await action('referral.members.apply')(memberRequest('referral.members.apply', { inviter: 'referral-member:parent' }), { query } as unknown as OperationDatabase);

    const sql = query.mock.calls.map((call) => String(call[0])).join('\n');
    expect(sql).not.toContain('with recursive');
    expect(sql).not.toContain('inviter.inviter_member_id');
    expect(query.mock.calls[3]?.[1]).toEqual(['mall:one', 'referral-member:parent', 'member:customer']);
    expect(query.mock.calls[4]?.[1]).toEqual([expect.stringMatching(/^referral-member:/), 'mall:one', 'member:customer', 'referral-member:parent', 'pending']);
    expect(response).toMatchObject({ status: 201, body: inserted });
  });

  it('enforces versioned member state transitions', async () => {
    const query = vi.fn(async (_text: string, _values?: readonly unknown[]) => result([]));
    await expect(action('referral.members.approve')(operatorRequest('referral.members.approve', { member: 'referral-member:one' }, 4), { query } as unknown as OperationDatabase)).rejects.toThrow('REFERRAL_MEMBER_STATE_CONFLICT');

    expect(String(query.mock.calls[0]?.[0])).toContain("state='pending' and version=$4");
    expect(query.mock.calls[0]?.[1]).toEqual(['referral-member:one', 'mall:one', 'actor:operator', 4]);
  });

  it('allocates an exact withdrawal oldest-first and only partially consumes the last commission', () => {
    expect(
      allocateWithdrawal(
        [
          { id: 'commission:old', available_minor: '40' },
          { id: 'commission:new', available_minor: '70' },
        ],
        80n
      )
    ).toEqual([
      { commission: 'commission:old', amount: 40n },
      { commission: 'commission:new', amount: 40n },
    ]);
    expect(() => allocateWithdrawal([{ id: 'commission:only', available_minor: '9' }], 10n)).toThrow('REFERRAL_WITHDRAW_INSUFFICIENT');
  });

  it('uses the member lock to serialize exact claims, then creates a referral finance withdrawal', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce(result([{ member: 'member:customer', scope: 'mall:one' }]))
      .mockResolvedValueOnce(
        result([
          {
            id: 'referral-member:self',
            member_id: 'member:customer',
            withdraw_min_minor: '10',
            withdraw_monthly_max: 10,
          },
        ])
      )
      .mockResolvedValueOnce(result([]))
      .mockResolvedValueOnce(result([{ withdrawal_count: 1 }]))
      .mockResolvedValueOnce(result([{ recovery_minor: '0' }]))
      .mockResolvedValueOnce(
        result([
          { id: 'commission:old', currency: 'CNY', available_minor: '40' },
          { id: 'commission:new', currency: 'CNY', available_minor: '70' },
        ])
      )
      .mockResolvedValueOnce(result([{ id: 'claim:one' }, { id: 'claim:two' }]))
      .mockResolvedValueOnce(
        result([
          {
            id: 'withdrawal:created',
            scope_id: 'mall:one',
            source_kind: 'referral',
            source_id: 'referral-member:self',
            beneficiary_member_id: 'member:customer',
            amount_minor: '80',
            version: 0,
          },
        ])
      )
      .mockResolvedValueOnce(result([{ id: 'claim:one' }, { id: 'claim:two' }]));

    const response = await action('referral.withdrawals.create')(
      memberRequest('referral.withdrawals.create', {
        amountMinor: 80,
        destinationRef: 'wallet:verified',
        reason: 'member request',
        evidence: { ticket: 'REF-1' },
      }),
      { query } as unknown as OperationDatabase
    );

    expect(String(query.mock.calls[1]?.[0])).toContain('for update of referral_member');
    expect(String(query.mock.calls[5]?.[0])).not.toContain('for update');
    expect(query.mock.calls[6]?.[1]?.[1]).toEqual(['commission:old', 'commission:new']);
    expect(query.mock.calls[6]?.[1]?.[2]).toEqual(['40', '40']);
    expect(String(query.mock.calls[7]?.[0])).toContain('source_kind,source_id,beneficiary_member_id');
    expect(query.mock.calls[7]?.[1]).toEqual([
      expect.stringMatching(/^withdrawal:/),
      'mall:one',
      'referral-member:self',
      'member:customer',
      80,
      'CNY',
      'wallet:verified',
      'actor:member',
      'member request',
      expect.stringContaining('"source":"referral"'),
    ]);
    expect(String(query.mock.calls[8]?.[0])).toContain('referral.attach_withdrawal_claims');
    expect(query.mock.calls[8]?.[1]).toEqual(['mall:one', expect.stringMatching(/^withdrawal:/), [expect.stringMatching(/^referral-claim:/), expect.stringMatching(/^referral-claim:/)]]);
    expect(response).toMatchObject({ status: 201, body: { claim_count: 2, claimed_minor: '80' } });
  });

  it('rejects a new withdrawal while an immutable cancellation or refund event still needs reversal', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce(result([{ member: 'member:customer', scope: 'mall:one' }]))
      .mockResolvedValueOnce(
        result([
          {
            id: 'referral-member:self',
            member_id: 'member:customer',
            withdraw_min_minor: '10',
            withdraw_monthly_max: 10,
          },
        ])
      )
      .mockResolvedValueOnce(result([{ blocked: true }]));

    await expect(
      action('referral.withdrawals.create')(
        memberRequest('referral.withdrawals.create', {
          amountMinor: 80,
          destinationRef: 'wallet:verified',
          reason: 'member request',
        }),
        { query } as unknown as OperationDatabase
      )
    ).rejects.toThrow('REFERRAL_WITHDRAW_REVERSAL_PENDING');
    expect(String(query.mock.calls[2]?.[0])).toContain('referral.has_pending_reversal');
    expect(query).toHaveBeenCalledTimes(3);
  });
});

function action(operation: string): OperationAction {
  const selected = (referralOperationActions() as Readonly<Record<string, unknown>>)[operation];
  if (typeof selected !== 'function') throw new Error(`TEST_OPERATION_MISSING:${operation}`);
  return selected as OperationAction;
}

function operatorRequest(type: string, body: Readonly<Record<string, unknown>>, expectedVersion?: number): OperationRequest {
  return request(type, body, { id: 'mall:one', kind: 'mall' }, 'membership:operator', 'actor:operator', expectedVersion);
}

function memberRequest(type: string, body: Readonly<Record<string, unknown>>): OperationRequest {
  return request(type, body, { id: 'member:customer', kind: 'owner' }, 'membership:customer', 'actor:member');
}

function request(type: string, body: Readonly<Record<string, unknown>>, scope: Readonly<{ id: string; kind: string }>, membership: string, actor: string, expectedVersion?: number): OperationRequest {
  return {
    type,
    access: {
      actor: { id: actor },
      membership: { id: membership },
      scope,
      trace: 'trace:referral',
    },
    input: {
      path: {},
      query: {},
      headers: {},
      body,
      rawBody: JSON.stringify(body),
      deadline: Date.now() + 5_000,
      signal: new AbortController().signal,
      idempotency: `idempotency:${type}`,
      ...(expectedVersion === undefined ? {} : { expectedVersion }),
    },
  } as unknown as OperationRequest;
}

function result(rows: readonly Record<string, unknown>[]): QueryResult<Record<string, unknown>> {
  return { rows, rowCount: rows.length } as unknown as QueryResult<Record<string, unknown>>;
}
