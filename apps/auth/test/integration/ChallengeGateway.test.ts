// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { IdentitySdk } from '../../src/shared/api/Client';
import { ChallengeGateway } from '../../src/feature/challenge/infrastructure/ChallengeGateway';
import { bootstrapPort, environment, identitySdk } from '../TestData';

describe('ChallengeGateway', () => {
  it('binds the challenge purpose and derives countdowns from server timestamps', async () => {
    const create = vi.fn<IdentitySdk['challengesCreate']>(async () => ({ id: 'challenge-1', purpose: 'login' as const, expires_at: new Date(Date.now() + 300_000).toISOString(), retry_at: new Date(Date.now() + 60_000).toISOString() }));
    const gateway = new ChallengeGateway(identitySdk({ challengesCreate: create }), environment, bootstrapPort());
    const result = await gateway.create({ purpose: 'login', destination: ' 13800000000 ' }, 'storefront', {});
    expect(create.mock.calls[0]?.[0].body).toEqual({ purpose: 'login', destination: '13800000000' });
    expect(result.validSeconds).toBeGreaterThanOrEqual(299);
    expect(result.resendSeconds).toBeGreaterThanOrEqual(59);
  });

  it('rejects inverted server timing', async () => {
    const create = vi.fn<IdentitySdk['challengesCreate']>(async () => ({ id: 'challenge-1', purpose: 'login' as const, expires_at: new Date(Date.now() + 10_000).toISOString(), retry_at: new Date(Date.now() + 20_000).toISOString() }));
    const gateway = new ChallengeGateway(identitySdk({ challengesCreate: create }), environment, bootstrapPort());
    await expect(gateway.create({ purpose: 'login', destination: '13800000000' }, 'storefront', {})).rejects.toThrow('CONTRACT_INVALID');
  });
});
