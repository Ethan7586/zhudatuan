import { describe, expect, it, vi } from 'vitest';
import { AccessPort } from './AccessPort';
import { PgAccessRepository } from './infrastructure/persistence/PgAccessRepository';
import { AccessVersionService } from './application/service/AccessVersionService';

function port(): AccessPort {
  const repository = new PgAccessRepository();
  return new AccessPort(repository, new AccessVersionService(repository));
}

describe('AccessPort directory membership resolution', () => {
  it('reads the access center without using a reserved SQL alias', async () => {
    const query = vi.fn(async (sql: string) => ({
      rows: [{ id: 'membership:one', client: 'console', status: 'active', access_version: '3', roles: [], scopes: [], overrides: [] }],
      rowCount: 1,
      sql,
    }));
    const repository = new PgAccessRepository();

    await expect(repository.center({ query } as never, { organization: 'mall:one', after: null, limit: 51 })).resolves.toEqual([
      { id: 'membership:one', client: 'console', status: 'active', accessVersion: 3, roles: [], scopes: [], overrides: [] },
    ]);
    expect(query.mock.calls[0]?.[0]).toContain('access.scopegrant scopegrant');
    expect(query.mock.calls[0]?.[0]).toContain('access.membershipoverride override');
    expect(query.mock.calls[0]?.[0]).not.toContain('access.scopegrant grant');
  });

  it('returns one principal and canonical target mappings', async () => {
    const database = {
      query: vi.fn(async () => ({
        rows: [
          { id: 'membership:console', principal_id: 'principal:one', client: 'console' },
          { id: 'membership:storefront', principal_id: 'principal:one', client: 'storefront' },
        ],
      })),
    };
    const result = await port().directoryMemberships(database as never, ['membership:storefront', 'membership:console', 'membership:console']);
    expect(result).toEqual({
      principal: 'principal:one',
      conflict: false,
      memberships: [
        { id: 'membership:console', target: 'console' },
        { id: 'membership:storefront', target: 'storefront' },
      ],
    });
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining('from access.membership'), [['membership:console', 'membership:storefront']]);
  });

  it('fails closed when directory bindings point at more than one principal', async () => {
    const database = {
      query: vi.fn(async () => ({
        rows: [
          { id: 'membership:one', principal_id: 'principal:one', client: 'console' },
          { id: 'membership:two', principal_id: 'principal:two', client: 'console' },
        ],
      })),
    };
    await expect(port().directoryMemberships(database as never, ['membership:one', 'membership:two'])).resolves.toEqual({ principal: null, memberships: [], conflict: true });
  });
});
