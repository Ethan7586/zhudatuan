import { describe, expect, it, vi } from 'vitest';
import type { VoucherOperations } from '@shop/sdk/voucher';
import type { RequestContext } from '@shop/sdk';
import type { StorefrontSession } from '../../../entity/session';
import { VoucherGateway } from './VoucherGateway';

describe('voucher activation gateway', () => {
  it.each(['numbersecret', 'secret'] as const)('uses the canonical %s operation with write and idempotency context', async (mode) => {
    const value = {
      id: 'voucher:one',
      product: 'product:one',
      productName: '节日福利',
      numberMasked: '****1234',
      initialMinor: 1000,
      remainingMinor: 1000,
      currency: 'CNY',
      state: 'active',
      validity: { startsAt: '2026-09-05T00:00:00.000Z', expiresAt: '2026-12-05T00:00:00.000Z' },
      version: 2,
    };
    const number = vi.fn(() => Promise.resolve(value));
    const secret = vi.fn(() => Promise.resolve(value));
    const context = vi.fn(() => ({ traceId: 'trace:one' }) as RequestContext);
    const session: StorefrontSession = { membership: 'member:one', scope: { kind: 'mall', id: 'mall:one' }, accessVersion: 1, csrfToken: 'csrf:one' };
    const signal = new AbortController().signal;
    const gateway = new VoucherGateway({ activationsNumbersecret: number, activationsSecret: secret } as unknown as VoucherOperations, context);
    const result = await gateway.activate(session, mode === 'numbersecret' ? { mode, number: 'VC001234', secret: 'Secret123' } : { mode, secret: 'Secret123' }, 'activation:key', signal);
    expect(context).toHaveBeenCalledWith(session, { write: true, idempotencyKey: 'activation:key', signal });
    expect(mode === 'numbersecret' ? number : secret).toHaveBeenCalledWith({ body: mode === 'numbersecret' ? { number: 'VC001234', secret: 'Secret123' } : { secret: 'Secret123' } }, { traceId: 'trace:one' });
    expect(mode === 'numbersecret' ? secret : number).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: value.id, numberMasked: value.numberMasked, remainingMinor: 1000, state: 'active' });
  });
});
