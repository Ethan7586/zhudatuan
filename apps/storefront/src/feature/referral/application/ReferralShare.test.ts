// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@shop/sdk';
import type { StorefrontSession } from '../../../entity/session';
import { ReferralShare } from './ReferralShare';

const session = { membership: 'membership:one', scope: { kind: 'mall', id: 'mall:one' }, accessVersion: 1, csrfToken: 'csrf:one' } as const satisfies StorefrontSession;
const token = `${'a'.repeat(32)}.${'b'.repeat(43)}`;

beforeEach(() => window.history.replaceState({}, '', '/s/mall-one/products/product:one'));

describe('referral product share', () => {
  it('keeps the storefront entry path and appends only the signed attribution token', async () => {
    const link = vi.fn().mockResolvedValue({ token, url: '?referral=ignored', expiresAt: '2026-09-08T00:00:00Z', productId: 'product:one' });
    const result = await new ReferralShare({ link }).execute(session, 'product:one', '/products/product:one');
    expect(result).toEqual({ url: `http://localhost:3000/s/mall-one/products/product:one?referral=${encodeURIComponent(token)}`, attributed: true });
  });

  it('shares a valid ordinary product URL when the member is not a promoter', async () => {
    const link = vi.fn().mockRejectedValue(new ApiError('REFERRAL_NOT_ELIGIBLE', 409, 'request:one'));
    await expect(new ReferralShare({ link }).execute(session, 'product:one', '/products/product:one')).resolves.toEqual({
      url: 'http://localhost:3000/s/mall-one/products/product:one',
      attributed: false,
    });
  });
});
