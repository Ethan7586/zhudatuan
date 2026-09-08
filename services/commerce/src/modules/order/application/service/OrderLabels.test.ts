import { describe, expect, it, vi } from 'vitest';
import { OrderLabels } from './OrderLabels';

describe('OrderLabels', () => {
  it('resolves member and organization names in bounded batches', async () => {
    const profiles = vi.fn(async () => Object.freeze([{ member: 'member:one', displayName: '王小明', mobileMasked: '138****0000' }]));
    const summaries = vi.fn(async () =>
      Object.freeze([
        { id: 'enterprise:one', name: '示例集团', kind: 'enterprise' },
        { id: 'mall:one', name: '员工福利商城', kind: 'mall' },
      ])
    );
    const labels = new OrderLabels({ profiles }, { summaries });

    await expect(
      labels.list({} as never, 'enterprise:one', false, [
        { member_id: 'member:one', scope_id: 'enterprise:one', mall_id: 'mall:one' },
        { member_id: 'member:one', scope_id: 'enterprise:one', mall_id: 'mall:one' },
      ])
    ).resolves.toEqual([
      { member_id: 'member:one', member_name: '王小明', scope_id: 'enterprise:one', scope_name: '示例集团', mall_id: 'mall:one', mall_name: '员工福利商城' },
      { member_id: 'member:one', member_name: '王小明', scope_id: 'enterprise:one', scope_name: '示例集团', mall_id: 'mall:one', mall_name: '员工福利商城' },
    ]);
    expect(profiles).toHaveBeenCalledExactlyOnceWith(expect.anything(), ['member:one'], 'enterprise:one');
    expect(summaries).toHaveBeenCalledExactlyOnceWith(expect.anything(), ['enterprise:one', 'mall:one']);
  });

  it('protects consumer identity from partner surfaces without resolving profiles', async () => {
    const profiles = vi.fn();
    const labels = new OrderLabels({ profiles }, { summaries: vi.fn(async () => Object.freeze([])) });

    const rows = await labels.list({} as never, 'supplier:one', true, [{ member_id: 'member:one', scope_id: 'enterprise:one', mall_id: 'mall:one' }]);

    expect(rows[0]).toMatchObject({ member_name: '消费者（隐私保护）' });
    expect(profiles).not.toHaveBeenCalled();
  });

  it('keeps the order list readable when a label projection is temporarily unavailable', async () => {
    const labels = new OrderLabels(
      { profiles: vi.fn(async () => Promise.reject(new Error('MEMBER_LABEL_UNAVAILABLE'))) },
      { summaries: vi.fn(async () => Promise.reject(new Error('ORGANIZATION_LABEL_UNAVAILABLE'))) }
    );

    const rows = await labels.list({} as never, 'enterprise:one', false, [{ member_id: 'member:one', scope_id: 'enterprise:one', mall_id: 'mall:one' }]);

    expect(rows[0]).toMatchObject({ member_name: '会员名称暂不可用', scope_name: '组织名称暂不可用', mall_name: '商城名称暂不可用' });
  });
});
