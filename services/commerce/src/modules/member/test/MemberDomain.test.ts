import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { PgTransactionAccess } from '../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../foundation/domain/DomainError';
import { withWriteTransaction } from '../../../test/TransactionFixture';
import { AddressBook } from '../domain/model/AddressBook';
import { FavoriteList } from '../domain/model/FavoriteList';
import { MemberProfile } from '../domain/model/MemberProfile';
import { Preference } from '../domain/model/Preference';
import { AddressPolicy } from '../domain/policy/AddressPolicy';
import { PgFavoriteRepository } from '../infrastructure/persistence/PgFavoriteRepository';

describe('Member domain', () => {
  it('keeps exactly one default address and promotes a replacement after business deletion', () => {
    const book = new AddressBook('member:one', [
      { id: 'address:one', state: 'active', isDefault: true, version: 3 },
      { id: 'address:two', state: 'active', isDefault: false, version: 1 },
    ]);
    expect(book.save('address:two', 1, true)).toEqual({ id: 'address:two', isDefault: true, expectedVersion: 1 });
    expect(book.remove('address:one', 3)).toEqual({ id: 'address:one', expectedVersion: 3, promote: 'address:two' });
    expect(
      () =>
        new AddressBook('member:one', [
          { id: 'address:one', state: 'active', isDefault: true, version: 3 },
          { id: 'address:two', state: 'active', isDefault: true, version: 1 },
        ])
    ).toThrow('MEMBER_DEFAULT_ADDRESS_DUPLICATE');
  });

  it('rejects stale address writes from another device', () => {
    const book = new AddressBook('member:one', [{ id: 'address:one', state: 'active', isDefault: true, version: 4 }]);
    expect(() => book.save('address:one', 3, true)).toThrow(DomainError);
    expect(() => book.remove('address:one', 3)).toThrow(DomainError);
  });

  it('normalizes PII once and exposes only masked presentation values', () => {
    const policy = new AddressPolicy();
    const value = policy.normalize({ recipient: ' 王小明 ', mobile: '138-0000-1234', address: ' 高新区创新大道 100 号 ', region: '四川省 / 成都市 / 高新区' });
    expect(policy.mask(value)).toEqual({ recipient: '王**', mobile: '138****1234', address: '高新区创新大道 ***' });
    expect(JSON.stringify(policy.mask(value))).not.toContain('13800001234');
    expect(JSON.stringify(policy.mask(value))).not.toContain('100 号');
  });

  it('explains invalid favorites while still allowing a member to remove them', () => {
    const list = new FavoriteList('member:one');
    expect(list.present({ listing: 'listing:one', createdAt: '2026-09-04T00:00:00.000Z', state: 'active', version: 2 }, { listing: 'listing:one', visible: false, reason: 'unpublished' })).toMatchObject({
      available: false,
      unavailableReason: '商品已下架，可取消收藏',
    });
    expect(list.change('listing:one', false, { listing: 'listing:one', visible: false, reason: 'removed' })).toEqual({ listing: 'listing:one', state: 'removed' });
    expect(() => list.change('listing:one', true, { listing: 'listing:one', visible: false, reason: 'outofscope' })).toThrow(DomainError);
  });

  it('uses one idempotent upsert for cross-device favorite changes and retains history', async () => {
    let version = 0;
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => {
      version += 1;
      return {
        rows: [{ listing_id: 'listing:one', created_at: '2026-09-04T00:00:00.000Z', status: 'active', version }],
        rowCount: 1,
      } as unknown as QueryResult;
    });
    const repository = new PgFavoriteRepository(new PgTransactionAccess());
    await expect(withWriteTransaction(query, (context) => repository.change(context, 'member:one', 'listing:one', 'active'))).resolves.toMatchObject({ version: 1 });
    await expect(withWriteTransaction(query, (context) => repository.change(context, 'member:one', 'listing:one', 'active'))).resolves.toMatchObject({ version: 2 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('on conflict(member_id,listing_id) do update set status=excluded.status'), ['member:one', 'listing:one', 'active']);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('delete from member.favorite'))).toBe(false);
  });

  it('models profile lifecycle and configurable preferences without shared mutable state', () => {
    const profile = new MemberProfile({ id: 'member:one', principal: 'principal:one', displayName: '测试成员', state: 'pending', version: 1 });
    expect(profile.activate('正式成员')).toMatchObject({ state: 'active', displayName: '正式成员', version: 2 });
    const preference = new Preference({ member: 'member:one', locale: 'zh-CN', timezone: 'Asia/Shanghai', marketingAllowed: false, version: 1 });
    expect(preference.revise({ locale: 'zh-CN', timezone: 'Asia/Shanghai', marketingAllowed: true })).toMatchObject({ marketingAllowed: true, version: 2 });
    expect(Object.isFrozen(preference)).toBe(true);
  });
});
