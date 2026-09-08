import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@shop/sdk';
import { ReferralAttributionCoordinator, referralCandidate } from './ReferralAttribution';

const TOKEN = `${'a'.repeat(32)}.${'b'.repeat(43)}`;
const OTHER_TOKEN = `${'c'.repeat(32)}.${'d'.repeat(43)}`;

describe('storefront referral attribution', () => {
  it('submits one valid signed-token shape while preserving unrelated query parameters', async () => {
    const bind = vi.fn().mockResolvedValue({ id: 'referralbinding:one' });
    const search = `?referral=${encodeURIComponent(TOKEN)}&sku=sku-one`;
    const coordinator = new ReferralAttributionCoordinator(bind);
    await expect(coordinator.capture({ search, mallId: 'mall:one', memberId: 'member:one' })).resolves.toEqual({ status: 'bound', candidateWon: true });
    expect(bind).toHaveBeenCalledWith(TOKEN);
    expect(search).toContain('sku=sku-one');
  });

  it.each([
    ['', { status: 'ignored', reason: 'absent' }],
    ['?sku=sku-one', { status: 'ignored', reason: 'absent' }],
    ['?referral=member-from-url', { status: 'ignored', reason: 'malformed' }],
    [`?referral=${TOKEN}&referral=${OTHER_TOKEN}`, { status: 'ignored', reason: 'malformed' }],
  ] as const)('rejects absent, duplicated or malformed tokens in %s', async (search, expected) => {
    const bind = vi.fn();
    await expect(new ReferralAttributionCoordinator(bind).capture({ search, mallId: 'mall:one', memberId: 'member:one' })).resolves.toEqual(expected);
    expect(bind).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent attempts and preserves the server first-touch winner', async () => {
    let release: (() => void) | undefined;
    const bind = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const coordinator = new ReferralAttributionCoordinator(bind);
    const input = { search: `?referral=${TOKEN}`, mallId: 'mall:one', memberId: 'member:one' };
    const first = coordinator.capture(input);
    await expect(coordinator.capture(input)).resolves.toEqual({ status: 'deduplicated' });
    release?.();
    await expect(first).resolves.toEqual({ status: 'bound', candidateWon: true });

    const existing = new ReferralAttributionCoordinator(vi.fn().mockRejectedValue(new ApiError('REFERRAL_ALREADY_BOUND', 409, 'request-one')));
    await expect(existing.capture(input)).resolves.toEqual({ status: 'bound', candidateWon: false });
  });

  it('never trusts mall or member identity supplied by the URL', async () => {
    const bind = vi.fn();
    const search = `?referral=${TOKEN}&mallId=url-mall&memberId=url-member`;
    await expect(new ReferralAttributionCoordinator(bind).capture({ search, mallId: '', memberId: '' })).resolves.toEqual({ status: 'ignored', reason: 'untrusted-context' });
    expect(bind).not.toHaveBeenCalled();
    expect(referralCandidate(search)).toEqual({ status: 'candidate', value: TOKEN });
  });

  it('allows a transiently failed attribution to be retried without retaining token fragments elsewhere', async () => {
    const bind = vi.fn().mockRejectedValueOnce(new Error('CONNECTION_FAILED')).mockResolvedValueOnce({});
    const coordinator = new ReferralAttributionCoordinator(bind);
    const input = { search: `?referral=${TOKEN}`, mallId: 'mall:one', memberId: 'member:one' };
    await expect(coordinator.capture(input)).resolves.toEqual({ status: 'failed' });
    await expect(coordinator.capture(input)).resolves.toEqual({ status: 'bound', candidateWon: true });
    expect(bind).toHaveBeenCalledTimes(2);
  });
});
