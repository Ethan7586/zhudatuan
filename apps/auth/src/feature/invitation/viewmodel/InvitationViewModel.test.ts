import { describe, expect, it, vi } from 'vitest';
import type { ResolveInvitation } from '../application/ResolveInvitation';
import { InvitationViewModel } from './InvitationViewModel';

describe('InvitationViewModel', () => {
  it('delegates only invitation resolution and keeps enrollment outside the feature', async () => {
    const resolve = vi.fn().mockResolvedValue({ kind: 'authenticated', redirectUrl: 'https://console.example/' });
    const viewmodel = new InvitationViewModel({ execute: resolve } as unknown as ResolveInvitation);
    await expect(viewmodel.resolve({ code: 'invite', session: { target: 'console' } })).resolves.toMatchObject({ kind: 'authenticated' });
    expect(resolve).toHaveBeenCalledOnce();
  });
});
