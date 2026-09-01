import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { InvitationLookup } from './InvitationLookup';

describe('InvitationLookup', () => {
  it('executes the same bounded repository lookup for malformed codes', async () => {
    const find = vi.fn(async () => Object.freeze({}));
    const candidates = vi.fn(() => Object.freeze([{ version: 'current', hash: Buffer.alloc(32) }]));
    const lookup = new InvitationLookup({ find } as never, { candidates } as never);
    await expect(lookup.find({} as never, 'malformed', 'storefront')).rejects.toMatchObject({ code: 'INVITATION_INVALID' });
    expect(candidates).toHaveBeenCalledOnce();
    expect(find).toHaveBeenCalledOnce();
  });

  it('does not conceal infrastructure failures as an invalid invitation', async () => {
    const failure = new Error('database unavailable');
    const lookup = new InvitationLookup(
      {
        lock: vi.fn(async () => {
          throw failure;
        }),
      } as never,
      { candidates: vi.fn(() => Object.freeze([])) } as never
    );
    await expect(lookup.lock({} as never, 'malformed', 'console')).rejects.toBe(failure);
  });

  it('conceals typed invitation state failures', async () => {
    const lookup = new InvitationLookup(
      {
        lock: vi.fn(async () => {
          throw new DomainError('INVITATION_STALE');
        }),
      } as never,
      { candidates: vi.fn(() => Object.freeze([])) } as never
    );
    await expect(lookup.lock({} as never, 'malformed', 'console')).rejects.toMatchObject({ code: 'INVITATION_INVALID' });
  });
});
