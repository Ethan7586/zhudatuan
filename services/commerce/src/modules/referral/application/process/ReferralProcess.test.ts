import { describe, expect, it, vi } from 'vitest';
import { ProcessReferralEvent } from './ProcessReferralEvent';
import { SettleReferral } from './SettleReferral';

const signal = new AbortController().signal;

describe('Referral processes', () => {
  it('preserves event identity and version ownership for inbox-idempotent processing', async () => {
    const process = vi.fn(async () => undefined);
    const event = { eventId: 'event:one', eventType: 'order.paid' as const, scopeId: 'mall:one', sourceId: 'order:one', resourceId: 'order:one' };
    await new ProcessReferralEvent({ process }).execute(event, signal, 1000);
    expect(process).toHaveBeenCalledWith(event, signal, 1000);
  });

  it('returns every skipped, failed and succeeded settlement receipt to the job boundary', async () => {
    const items = [
      { source: 'commission' as const, id: 'commission:one', outcome: 'skipped' as const, reference: null, error: null },
      { source: 'commission' as const, id: 'commission:two', outcome: 'failed' as const, reference: null, error: 'FINANCE_UNAVAILABLE' },
      { source: 'withdrawal' as const, id: 'withdrawal:one', outcome: 'succeeded' as const, reference: 'journal:one', error: null },
    ];
    const settle = vi.fn(async () => Object.freeze({ scopeId: 'mall:one', items: Object.freeze(items) }));
    const result = await new SettleReferral({ settle }).execute('mall:one', null, signal, 1000);
    expect(result.items.map(({ outcome }) => outcome)).toEqual(['skipped', 'failed', 'succeeded']);
    expect(settle).toHaveBeenCalledOnce();
  });
});
