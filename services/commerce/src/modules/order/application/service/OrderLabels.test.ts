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
    const principals = vi.fn(async () => Object.freeze([{ principal: 'principal:one', displayName: '王小明', mobileMasked: '138****0000' }]));
    const names = vi.fn(async () => new Map([['partner:one', '央企供应链']]));
    const labels = new OrderLabels({ profiles, principals }, { summaries }, { names });

    await expect(
      labels.list({} as never, 'enterprise:one', false, [
        { member_id: 'member:one', scope_id: 'enterprise:one', mall_id: 'mall:one', lines: [{ partner: 'partner:one' }], fulfillments: [] },
        { member_id: 'member:one', scope_id: 'enterprise:one', mall_id: 'mall:one', lines: [], fulfillments: [{ partner: 'partner:one' }] },
      ])
    ).resolves.toEqual([
      { member_id: 'member:one', member_name: '王小明', scope_id: 'enterprise:one', scope_name: '示例集团', mall_id: 'mall:one', mall_name: '员工福利商城', lines: [{ partner: 'partner:one', partnerName: '央企供应链' }], fulfillments: [] },
      { member_id: 'member:one', member_name: '王小明', scope_id: 'enterprise:one', scope_name: '示例集团', mall_id: 'mall:one', mall_name: '员工福利商城', lines: [], fulfillments: [{ partner: 'partner:one', partnerName: '央企供应链' }] },
    ]);
    expect(profiles).toHaveBeenCalledExactlyOnceWith(expect.anything(), ['member:one'], 'enterprise:one');
    expect(summaries).toHaveBeenCalledExactlyOnceWith(expect.anything(), ['enterprise:one', 'mall:one']);
    expect(names).toHaveBeenCalledExactlyOnceWith(expect.anything(), ['partner:one']);
    expect(principals).not.toHaveBeenCalled();
  });

  it('protects consumer identity from partner surfaces without resolving profiles', async () => {
    const profiles = vi.fn();
    const labels = new OrderLabels({ profiles, principals: vi.fn() }, { summaries: vi.fn(async () => Object.freeze([])) }, { names: vi.fn(async () => new Map()) });

    const rows = await labels.list({} as never, 'supplier:one', true, [{ member_id: 'member:one', scope_id: 'enterprise:one', mall_id: 'mall:one' }]);

    expect(rows[0]).toMatchObject({ member_name: '消费者（隐私保护）' });
    expect(profiles).not.toHaveBeenCalled();
  });

  it('keeps the order list readable when a label projection is temporarily unavailable', async () => {
    const labels = new OrderLabels(
      {
        profiles: vi.fn(async () => Promise.reject(new Error('MEMBER_LABEL_UNAVAILABLE'))),
        principals: vi.fn(async () => Promise.reject(new Error('PRINCIPAL_LABEL_UNAVAILABLE'))),
      },
      { summaries: vi.fn(async () => Promise.reject(new Error('ORGANIZATION_LABEL_UNAVAILABLE'))) },
      { names: vi.fn(async () => Promise.reject(new Error('PARTNER_LABEL_UNAVAILABLE'))) }
    );

    const rows = await labels.list({} as never, 'enterprise:one', false, [{ member_id: 'member:one', scope_id: 'enterprise:one', mall_id: 'mall:one' }]);

    expect(rows[0]).toMatchObject({ member_name: '会员名称暂不可用', scope_name: '组织名称暂不可用', mall_name: '商城名称暂不可用' });
  });

  it('resolves audit actors and provides readable fallbacks without exposing identifiers', async () => {
    const labels = new OrderLabels({ profiles: vi.fn(), principals: vi.fn(async () => Object.freeze([{ principal: 'principal:one', displayName: '王小明', mobileMasked: null }])) }, { summaries: vi.fn() }, { names: vi.fn() });

    const resolved = await labels.resolve({} as never, 'enterprise:one', {
      members: [],
      organizations: [],
      partners: [],
      principals: ['principal:one'],
      privateMembers: false,
    });

    expect(resolved.actor('principal:one', 'principal')).toBe('王小明');
    expect(resolved.actor('principal:missing', 'principal')).toBe('操作人资料受保护');
    expect(resolved.actor(null, 'system')).toBe('系统自动处理');
    expect(resolved.partner('partner:missing')).toBe('合作方名称暂不可用');
  });
});
