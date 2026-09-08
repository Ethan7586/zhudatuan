import { describe, expect, it, vi } from 'vitest';
import type { ReferralOperations } from '@shop/sdk/referral';
import type { StorefrontSession } from '../../../entity/session';
import { ReferralGateway } from './ReferralGateway';

const session = { membership: 'membership:one', scope: { kind: 'mall', id: 'mall:one' }, accessVersion: 1, csrfToken: 'csrf:one' } as const satisfies StorefrontSession;

describe('referral gateway', () => {
  it('never derives an idempotency key from the signed referral token', async () => {
    const token = `${'a'.repeat(32)}.${'b'.repeat(43)}`;
    const create = vi.fn().mockResolvedValue({});
    const context = vi.fn().mockReturnValue({ traceId: 'trace:one' });
    await new ReferralGateway({ bindingsCreate: create } as unknown as ReferralOperations, context).bind(session, token);
    expect(create).toHaveBeenCalledWith({ body: { token, source: 'storefront' } }, { traceId: 'trace:one' });
    const options = context.mock.calls[0]?.[1] as Readonly<{ idempotencyKey: string }>;
    expect(options.idempotencyKey).toMatch(/^referral:binding:/);
    expect(options.idempotencyKey).not.toContain(token.slice(-32));
  });
});
