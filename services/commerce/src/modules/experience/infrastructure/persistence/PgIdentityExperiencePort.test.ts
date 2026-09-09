import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { PgIdentityExperiencePort } from './PgIdentityExperiencePort';

describe('PgIdentityExperiencePort', () => {
  it('resolves the canonical storefront handle through the security-definer boundary', async () => {
    const query = vi.fn(async () => ({ rows: [{ handle: 'zhudatuan-local' }], rowCount: 1 }) as unknown as QueryResult);

    await expect(new PgIdentityExperiencePort({ database: () => ({ query }) } as never).storefront({ mode: 'read' } as never, 'mall:zhudatuan')).resolves.toEqual({ handle: 'zhudatuan-local' });
    expect(query).toHaveBeenCalledWith('select handle from experience.identity_storefront($1)', ['mall:zhudatuan']);
  });

  it('returns no destination when the membership has no active primary storefront', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }) as unknown as QueryResult);

    await expect(new PgIdentityExperiencePort({ database: () => ({ query }) } as never).storefront({ mode: 'read' } as never, 'mall:disabled')).resolves.toBeNull();
  });
});
