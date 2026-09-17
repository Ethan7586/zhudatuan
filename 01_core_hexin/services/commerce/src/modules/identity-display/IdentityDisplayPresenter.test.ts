import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { presentIdentityDisplays } from './IdentityDisplayPresenter';

describe('identity display presenter', () => {
  it('allocates a batch without per-membership queries', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ mapping: 'identity_display.code_mapping' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [
        { membership_id: 'membership:one', code: 'OP-7K2M8Q' },
        { membership_id: 'membership:two', code: 'OP-8R3A5B' },
      ] });
    const result = await presentIdentityDisplays({ query } as unknown as OperationDatabase, 'mall:one', 'operator', [
      { membershipId: 'membership:one', maskedMobile: '134****7586' },
      { membershipId: 'membership:two', maskedMobile: '192****7586' },
    ]);
    expect(query).toHaveBeenCalledTimes(5);
    expect(result.get('membership:one')).toMatchObject({ kind: 'operator', label: '管理身份', maskedMobile: '134****7586' });
    expect(result.get('membership:two')?.code).toMatch(/^OP-[2-9A-HJKMNP-Z]{6}$/);
    expect(result.get('membership:one')?.code).not.toBe(result.get('membership:two')?.code);
  });

  it('omits the optional projection when its repository is unavailable', async () => {
    const database = { query: vi.fn().mockRejectedValue(new Error('mapping unavailable')) } as unknown as OperationDatabase;
    await expect(presentIdentityDisplays(database, 'mall:one', 'member', [
      { membershipId: 'membership:one' },
    ])).resolves.toEqual(new Map());
  });
});
