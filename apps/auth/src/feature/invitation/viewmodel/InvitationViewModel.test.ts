import { describe, expect, it, vi } from 'vitest';
import type { CompleteEnrollment } from '../application/CompleteEnrollment';
import type { ReadEnrollment } from '../application/ReadEnrollment';
import type { ResolveInvitation } from '../application/ResolveInvitation';
import { InvitationViewModel } from './InvitationViewModel';

describe('InvitationViewModel', () => {
  it('keeps resolve, read, and completion as separate application commands', async () => {
    const resolve = vi.fn().mockResolvedValue({ kind: 'authenticated', redirectUrl: 'https://console.example/' });
    const read = vi.fn().mockResolvedValue({ id: 'enrollment:1' });
    const complete = vi.fn().mockResolvedValue({ kind: 'enrolled', target: 'storefront' });
    const viewmodel = new InvitationViewModel({ execute: resolve } as unknown as ResolveInvitation, { execute: read } as unknown as ReadEnrollment, { execute: complete } as unknown as CompleteEnrollment);
    await expect(viewmodel.resolve({ code: 'invite', target: 'console', returns: {} })).resolves.toMatchObject({ kind: 'authenticated' });
    await expect(viewmodel.read('enrollment:1')).resolves.toEqual({ id: 'enrollment:1' });
    expect(complete).not.toHaveBeenCalled();
  });
});
