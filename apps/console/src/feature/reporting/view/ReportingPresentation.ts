import { chineseDomainLabel, chineseReference } from '@shop/presentation';

export const reportLabels = Object.freeze({ sales: '销售总览', products: '商品销售', malls: '商城销售', categories: '分类销售', channels: '渠道销售', voucher: '卡券消费' } as const);
export const periodLabels = Object.freeze({ realtime: '实时', yesterday: '昨日', '7days': '近 7 日', '30days': '近 30 日' } as const);

export function dimensionText(dimensions: Readonly<Record<string, string>>): string {
  return (
    Object.entries(dimensions)
      .map(([key, value]) => `${chineseDomainLabel(key, '数据维度')}：${/[\u3400-\u9fff]/.test(value) ? value : chineseDomainLabel(value, chineseReference('数据项', value))}`)
      .join(' · ') || '全部'
  );
}
