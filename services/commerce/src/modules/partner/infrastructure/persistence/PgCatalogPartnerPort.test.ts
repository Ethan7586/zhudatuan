import { describe, expect, it, vi } from 'vitest';
import { result, withReadTransaction } from '../../../../test/TransactionFixture';
import { PgCatalogPartnerPort } from './PgCatalogPartnerPort';

describe('PgCatalogPartnerPort', () => {
  it('resolves distinct partner names in one read without hiding historical partners', async () => {
    const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
      expect(sql).toContain('select id,name from partner.partner');
      expect(sql).not.toContain("status='active'");
      expect(values).toEqual([['partner:two', 'partner:one']]);
      return result([
        { id: 'partner:one', name: '央企供应链' },
        { id: 'partner:two', name: '本地验收供应商' },
      ]);
    });

    await expect(withReadTransaction(query, (context) => new PgCatalogPartnerPort().names(context, ['partner:two', 'partner:one', 'partner:two']))).resolves.toEqual(
      new Map([
        ['partner:one', '央企供应链'],
        ['partner:two', '本地验收供应商'],
      ])
    );
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('does not query for an empty name request', async () => {
    const query = vi.fn(async () => result([]));
    await expect(withReadTransaction(query, (context) => new PgCatalogPartnerPort().names(context, []))).resolves.toEqual(new Map());
    expect(query).not.toHaveBeenCalled();
  });
});
