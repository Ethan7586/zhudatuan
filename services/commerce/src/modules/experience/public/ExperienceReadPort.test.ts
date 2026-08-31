import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { PgExperienceReadPort } from './ExperienceReadPort';

describe('PgExperienceReadPort', () => {
  it('resolves a public host through the narrow security boundary', async () => {
    const row = Object.freeze({
      application: 'application:one',
      mall: 'mall:one',
      pool: 'pool:one',
      release: 'release:one',
      version: 'version:one',
      tenant: 'tenant:one',
    });
    const query = vi.fn(async () => ({ rows: [row], rowCount: 1 }) as unknown as QueryResult);
    const pool = { query, workload: () => pool } as unknown as DatabasePool;

    await expect(new PgExperienceReadPort(pool).resolveHost('shop.example.com')).resolves.toEqual(row);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('experience.resolve_storefront_host($1)'), ['shop.example.com']);
  });

  it('rejects a host without an active valid release', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }) as unknown as QueryResult);
    const pool = { query, workload: () => pool } as unknown as DatabasePool;
    await expect(new PgExperienceReadPort(pool).resolveHost('missing.example.com')).rejects.toThrow('STOREFRONT_HOST_NOT_PUBLISHED');
  });
});
