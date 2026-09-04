import { describe, expect, it, vi } from 'vitest';
import { PgMembershipResolver } from './PgAccessResolvers';

describe('PgMembershipResolver authorization time snapshot', () => {
  it('returns the database evaluation time with the resolved membership', async () => {
    const evaluatedAt = new Date('2026-08-30T00:00:00.501Z');
    const query = vi.fn().mockResolvedValue({
      rows: [{ id: 'membership:one', active: true, access_version: 7, denies: [], grants: [], evaluated_at: evaluatedAt }],
    });
    const resolver = new PgMembershipResolver({ query } as never);

    await expect(resolver.resolve('membership:one')).resolves.toMatchObject({
      access: { id: 'membership:one', accessVersion: 7 },
      evaluatedAt,
    });
    expect(query.mock.calls[0]?.[0]).toContain('clock_timestamp() evaluated_at');
  });

  it('fails closed when PostgreSQL does not return a valid decision time', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ id: 'membership:one', active: true, access_version: 1, denies: [], grants: [], evaluated_at: 'invalid' }],
    });
    const resolver = new PgMembershipResolver({ query } as never);

    await expect(resolver.resolve('membership:one')).rejects.toThrow('AUTHORIZATION_TIME_INVALID');
  });
});
