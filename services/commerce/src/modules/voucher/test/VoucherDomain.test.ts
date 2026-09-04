import { describe, expect, it } from 'vitest';
import { ActionBatch } from '../domain/model/ActionBatch';
import { Credential } from '../domain/model/Credential';
import { CredentialPool } from '../domain/model/CredentialPool';
import { IssueBatch } from '../domain/model/IssueBatch';
import { Redemption } from '../domain/model/Redemption';
import { TenderHold } from '../domain/model/TenderHold';
import { Voucher } from '../domain/model/Voucher';

const NOW = new Date('2026-09-05T00:00:00.000Z');

describe('voucher domain invariants', () => {
  it('claims and activates an allocated voucher in one monotonic version', () => {
    const allocated = new Voucher({ ...activeVoucher().value, holder: null, state: 'allocated' });
    expect(allocated.activate(NOW, 'holder:claimed').value).toMatchObject({ state: 'active', holder: 'holder:claimed', version: 2 });
    expect(() => activeVoucher().disable().activate(NOW)).toThrow('VOUCHER_STATE_INVALID');
    expect(activeVoucher().disable().enable(NOW).value.state).toBe('active');
  });
  it('keeps credential allocation one-way and bound to one issue batch', () => {
    const available = new Credential({ id: 'credential:one', pool: 'pool:one', product: 'product:one', fingerprint: 'a'.repeat(64), keyVersion: 'key:v1', state: 'generated', issueBatch: null, version: 1 }).available();
    const allocated = available.allocate('issuebatch:one');
    expect(allocated.value).toMatchObject({ state: 'allocated', issueBatch: 'issuebatch:one', version: 3 });
    expect(() => allocated.allocate('issuebatch:two')).toThrow('VOUCHER_STATE_INVALID');
  });

  it('rejects pool over-allocation and closure reuse', () => {
    const pool = new CredentialPool({ id: 'pool:one', scope: 'platform:one', product: 'product:one', name: '卡号库', mode: 'generated', prefix: 'VC', capacity: 2, generated: 1, state: 'open', version: 1 });
    expect(pool.reserve(1).value.generated).toBe(2);
    expect(() => pool.reserve(2)).toThrow('VOUCHER_STOCK_INSUFFICIENT');
    expect(() => pool.close().reserve(1)).toThrow('VOUCHER_POOL_CLOSED');
  });

  it('retries only failed batch items classified as retryable', () => {
    const issue = new IssueBatch({ id: 'issuebatch:one', order: 'issueorder:one', state: 'failed', requested: 3, processed: 3, succeeded: 1, failed: 2, retryable: 1, version: 4 }).retry();
    const action = new ActionBatch({ id: 'actionbatch:one', snapshot: 'snapshot:one', action: 'disable', state: 'failed', requested: 3, processed: 3, succeeded: 1, failed: 2, retryable: 1, version: 4 }).retry();
    expect(issue.value).toMatchObject({ state: 'queued', processed: 2, failed: 1, retryable: 0 });
    expect(action.value).toMatchObject({ state: 'queued', processed: 2, failed: 1, retryable: 0 });
  });

  it('makes consume and release mutually exclusive and enforces expiry', () => {
    const hold = new TenderHold({ id: 'hold:one', voucher: 'voucher:one', owner: 'order:one', amountMinor: 100, state: 'active', expiresAt: new Date(NOW.getTime() + 60_000), idempotency: 'hold:key', version: 1 });
    expect(hold.consume(NOW).value.state).toBe('consumed');
    expect(() => hold.consume(NOW).release(NOW)).toThrow('VOUCHER_HOLD_CONFLICT');
    expect(() => hold.consume(new Date(NOW.getTime() + 60_000))).toThrow('VOUCHER_HOLD_EXPIRED');
  });

  it('preserves voucher value through hold, partial redemption and refund', () => {
    const voucher = activeVoucher().hold().redeem(400).refund(100);
    expect(voucher.value).toMatchObject({ state: 'active', remainingMinor: 700, version: 4 });
    expect(() => voucher.refund(400)).toThrow('VOUCHER_REFUND_EXCEEDS_REDEMPTION');
  });

  it('atomically redeems an active voucher in a single version without bypassing an existing hold', () => {
    expect(activeVoucher().redeemAtomic(400).value).toMatchObject({ state: 'active', remainingMinor: 600, version: 2 });
    expect(activeVoucher().redeemAtomic(1000).value).toMatchObject({ state: 'redeemed', remainingMinor: 0, version: 2 });
    expect(() => activeVoucher().hold().redeemAtomic(400)).toThrow('VOUCHER_NOT_REDEEMABLE');
    expect(() => activeVoucher().disable().redeemAtomic(400)).toThrow('VOUCHER_NOT_REDEEMABLE');
    for (const amount of [NaN, Infinity, 0, -1, 0.5, 1001]) {
      expect(() => activeVoucher().redeemAtomic(amount)).toThrow('VOUCHER_NOT_REDEEMABLE');
      expect(() => activeVoucher().hold().redeem(amount)).toThrow('VOUCHER_NOT_REDEEMABLE');
    }
  });

  it('prevents cumulative redemption refunds from exceeding the original amount', () => {
    const redemption = new Redemption({ id: 'redemption:one', voucher: 'voucher:one', hold: 'hold:one', verification: 'proof:one', amountMinor: 400, refundedMinor: 0, state: 'succeeded', version: 1 }).refund(100).refund(300);
    expect(redemption.value).toMatchObject({ state: 'refunded', refundedMinor: 400, version: 3 });
    expect(() => redemption.refund(1)).toThrow('VOUCHER_REFUND_EXCEEDS_REDEMPTION');
  });
});

function activeVoucher(): Voucher {
  return new Voucher({ id: 'voucher:one', credential: 'credential:one', product: 'product:one', holder: 'holder:one', initialMinor: 1000, remainingMinor: 1000, state: 'active', startsAt: new Date(NOW.getTime() - 60_000), expiresAt: new Date(NOW.getTime() + 60_000), version: 1 });
}
