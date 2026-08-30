import { describe, expect, it, vi } from 'vitest';
import { ReferralAttributionCoordinator, referralCandidate } from './referralAttribution';

const CANDIDATE = 'referral-member:123e4567-e89b-42d3-a456-426614174000';
const OTHER_CANDIDATE = 'referral-member:123e4567-e89b-42d3-a456-426614174001';

describe('storefront referral attribution', () => {
  it('submits a valid first-touch candidate without consuming the sku query', async () => {
    const bind = vi.fn().mockResolvedValue({ candidate_won: true });
    const coordinator = new ReferralAttributionCoordinator(bind);
    const search = `?referral=${encodeURIComponent(CANDIDATE)}&sku=sku-one`;

    await expect(coordinator.capture({ search, mallId: 'mall-one', memberId: 'member-one' })).resolves.toEqual({ status: 'bound', candidateWon: true });
    expect(bind).toHaveBeenCalledOnce();
    expect(bind).toHaveBeenCalledWith(CANDIDATE);
    expect(search).toContain('sku=sku-one');
  });

  it.each([
    ['', { status: 'ignored', reason: 'absent' }],
    ['?sku=sku-one', { status: 'ignored', reason: 'absent' }],
    ['?referral=member-from-url', { status: 'ignored', reason: 'malformed' }],
    [`?referral=${CANDIDATE}&referral=${OTHER_CANDIDATE}`, { status: 'ignored', reason: 'malformed' }],
  ] as const)('ignores an absent or malformed candidate in %s', async (search, expected) => {
    const bind = vi.fn();
    const coordinator = new ReferralAttributionCoordinator(bind);

    await expect(coordinator.capture({ search, mallId: 'mall-one', memberId: 'member-one' })).resolves.toEqual(expected);
    expect(bind).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent and later replays for the same trusted identity tuple', async () => {
    let resolveBinding: ((value: unknown) => void) | undefined;
    const bind = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveBinding = resolve;
        })
    );
    const coordinator = new ReferralAttributionCoordinator(bind);
    const input = { search: `?referral=${CANDIDATE}`, mallId: 'mall-one', memberId: 'member-one' };

    const first = coordinator.capture(input);
    await expect(coordinator.capture(input)).resolves.toEqual({ status: 'deduplicated' });
    resolveBinding?.({ candidate_won: true });
    await expect(first).resolves.toEqual({ status: 'bound', candidateWon: true });
    await expect(coordinator.capture(input)).resolves.toEqual({ status: 'deduplicated' });
    expect(bind).toHaveBeenCalledOnce();
  });

  it('lets the server keep an existing winner and does not retry a safe failure', async () => {
    const existingWinner = vi.fn().mockResolvedValue({
      candidate_won: false,
      winner_referral_member_id: OTHER_CANDIDATE,
    });
    const coordinator = new ReferralAttributionCoordinator(existingWinner);
    const input = { search: `?referral=${CANDIDATE}`, mallId: 'mall-one', memberId: 'member-one' };

    await expect(coordinator.capture(input)).resolves.toEqual({ status: 'bound', candidateWon: false });
    await expect(coordinator.capture(input)).resolves.toEqual({ status: 'deduplicated' });
    expect(existingWinner).toHaveBeenCalledOnce();

    const failedBinding = vi.fn().mockRejectedValue(new Error('network unavailable'));
    const failed = new ReferralAttributionCoordinator(failedBinding);
    await expect(failed.capture(input)).resolves.toEqual({ status: 'failed' });
    await expect(failed.capture(input)).resolves.toEqual({ status: 'deduplicated' });
    expect(failedBinding).toHaveBeenCalledOnce();
  });

  it('never derives the authenticated mall or member identity from URL parameters', async () => {
    const bind = vi.fn();
    const coordinator = new ReferralAttributionCoordinator(bind);
    const search = `?referral=${CANDIDATE}&mallId=url-mall&memberId=url-member`;

    await expect(coordinator.capture({ search, mallId: '', memberId: '' })).resolves.toEqual({ status: 'ignored', reason: 'untrusted-context' });
    expect(bind).not.toHaveBeenCalled();
    expect(referralCandidate(search)).toEqual({ status: 'candidate', value: CANDIDATE });
  });
});
