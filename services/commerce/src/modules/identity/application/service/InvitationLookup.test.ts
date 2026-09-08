import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../../../../platform/error/DomainError';
import { InvitationLookup } from './InvitationLookup';

const CODE = 'A'.repeat(32);

describe('InvitationLookup', () => {
  it.each(['INVITATION_ACCEPTED', 'INVITATION_EXPIRED', 'INVITATION_REVOKED'] as const)('preserves %s only after a valid code reaches repository lookup', async (code) => {
    const find = vi.fn().mockRejectedValue(new DomainError(code));
    const lookup = new InvitationLookup({ find } as never, { candidates: vi.fn(() => []) } as never);
    await expect(lookup.find({} as never, CODE, 'storefront')).rejects.toMatchObject({ code });
    expect(find).toHaveBeenCalledOnce();
  });

  it('keeps malformed and unknown codes indistinguishable', async () => {
    const find = vi.fn().mockRejectedValue(new DomainError('INVITATION_NOT_FOUND'));
    const lookup = new InvitationLookup({ find } as never, { candidates: vi.fn(() => []) } as never);
    await expect(lookup.find({} as never, 'malformed', 'storefront')).rejects.toMatchObject({ code: 'INVITATION_INVALID' });
    await expect(lookup.find({} as never, CODE, 'storefront')).rejects.toMatchObject({ code: 'INVITATION_INVALID' });
  });
});
