import { describe, expect, it, vi } from 'vitest';
import { DimensionReader } from '../application/service/DimensionReader';
import type { MetricRow } from '../domain/model/Metric';

describe('report dimension reader', () => {
  it('resolves every entity identifier in batches and never exposes a missing identifier as display text', async () => {
    const applications = vi.fn().mockResolvedValue([{ id: 'application:one', name: '员工商城', mall: 'mall:one', mallName: '总部福利商城' }]);
    const reader = new DimensionReader(
      {
        summaries: vi.fn().mockResolvedValue([
          { id: 'mall:one', name: '总部福利商城', kind: 'mall' },
          { id: 'enterprise:one', name: '示例企业', kind: 'enterprise' },
        ]),
      } as never,
      { applications } as never,
      {
        labels: vi.fn().mockResolvedValue([
          { kind: 'product', id: 'product:one', name: '五常大米礼盒' },
          { kind: 'category', id: 'category:one', name: '食品饮料' },
        ]),
      } as never,
      {
        profiles: vi.fn().mockResolvedValue([{ member: 'member:one', displayName: '王小明', mobileMasked: '138****0000' }]),
      } as never,
      { names: vi.fn().mockResolvedValue(new Map([['store:one', '人民广场店']])) } as never
    );

    const [presented] = await reader.present({} as never, 'enterprise:one', [metric()]);
    expect(presented?.displayedDimensions).toEqual([
      { code: 'mall', name: '商城', value: '总部福利商城' },
      { code: 'application', name: '商城应用', value: '员工商城' },
      { code: 'product', name: '商品', value: '五常大米礼盒' },
      { code: 'category', name: '商品分类', value: '食品饮料' },
      { code: 'channel', name: '业务渠道', value: '自营商城' },
      { code: 'customer', name: '客户范围', value: '示例企业' },
      { code: 'member', name: '会员', value: '王小明' },
      { code: 'currency', name: '币种', value: '人民币' },
      { code: 'store', name: '门店', value: '人民广场店' },
    ]);
    expect(JSON.stringify(presented?.displayedDimensions)).not.toMatch(/(?:mall|application|product|category|enterprise|member|store):one/);
    expect(applications).toHaveBeenCalledWith(expect.anything(), 'enterprise:one', ['application:one']);
  });

  it('hides an unresolved entity identifier even when the identifier contains readable Chinese text', async () => {
    const reader = new DimensionReader(
      { summaries: vi.fn().mockResolvedValue([]) } as never,
      { applications: vi.fn().mockResolvedValue([]) } as never,
      { labels: vi.fn().mockResolvedValue([]) } as never,
      { profiles: vi.fn().mockResolvedValue([]) } as never,
      { names: vi.fn().mockResolvedValue(new Map()) } as never
    );
    const source = metric();
    const [presented] = await reader.present({} as never, 'enterprise:one', [{ ...source, definition: { ...source.definition, dimensions: ['product'] }, dimensions: { product: '商品编号:未授权:1001' } }]);

    expect(presented?.displayedDimensions).toEqual([{ code: 'product', name: '商品', value: '已停用或无权查看的商品' }]);
    expect(JSON.stringify(presented?.displayedDimensions)).not.toContain('商品编号:未授权:1001');
  });

  it('resolves cockpit category names in the same catalog batch as metric dimensions', async () => {
    const labels = vi.fn().mockResolvedValue([
      { kind: 'category', id: 'category:one', name: '食品饮料' },
      { kind: 'category', id: 'category:two', name: '办公用品' },
    ]);
    const reader = new DimensionReader(
      { summaries: vi.fn().mockResolvedValue([]) } as never,
      { applications: vi.fn().mockResolvedValue([]) } as never,
      { labels } as never,
      { profiles: vi.fn().mockResolvedValue([]) } as never,
      { names: vi.fn().mockResolvedValue(new Map()) } as never
    );

    const presentation = await reader.resolve({} as never, 'enterprise:one', [metric()], ['category:two', 'category:missing']);

    expect(presentation.categoryNames).toEqual(
      new Map([
        ['category:two', '办公用品'],
        ['category:missing', '已停用或无权查看的分类'],
        ['category:one', '食品饮料'],
      ])
    );
    expect(labels).toHaveBeenCalledTimes(1);
    expect(labels).toHaveBeenCalledWith(expect.anything(), { products: ['product:one'], categories: ['category:two', 'category:missing', 'category:one'] });
  });

  it('returns concise application options and disambiguates duplicate names with the mall name', async () => {
    const reader = new DimensionReader(
      {} as never,
      {
        applications: vi.fn().mockResolvedValue([
          { id: 'application:one', name: '员工商城', mall: 'mall:one', mallName: '华东商城' },
          { id: 'application:two', name: '员工商城', mall: 'mall:two', mallName: '华南商城' },
          { id: 'application:three', name: '节日商城', mall: 'mall:one', mallName: '华东商城' },
        ]),
      } as never,
      {} as never,
      {} as never,
      {} as never
    );

    const result = await reader.catalogFor({} as never, 'enterprise:one');
    expect(result.applications).toEqual([
      { value: 'application:one', label: '员工商城 · 华东商城' },
      { value: 'application:two', label: '员工商城 · 华南商城' },
      { value: 'application:three', label: '节日商城' },
    ]);
    expect(result.presets[0]).not.toHaveProperty('reportDimension');
  });
});

function metric(): MetricRow {
  return {
    code: 'sales.amount',
    version: 1,
    definition: {
      name: '成交金额',
      formula: '支付金额合计',
      dimensions: ['mall', 'application', 'product', 'category', 'channel', 'customer', 'member', 'currency', 'store'],
      granularity: 'day',
      owner: 'reporting',
    },
    scope: 'enterprise:one',
    period: { from: '2026-09-01T00:00:00.000Z', to: '2026-09-02T00:00:00.000Z', timezone: 'Asia/Shanghai' },
    dimensions: {
      mall: 'mall:one',
      application: 'application:one',
      product: 'product:one',
      category: 'category:one',
      channel: 'internal',
      customer: 'enterprise:one',
      member: 'member:one',
      currency: 'CNY',
      store: 'store:one',
    },
    value: 100,
    unit: 'minor',
    currency: 'CNY',
    watermark: '2026-09-02T00:00:00.000Z',
    projectionVersion: 1,
    cursorTime: '2026-09-02T00:00:00.000Z',
    cursorId: 'row:one',
  };
}
