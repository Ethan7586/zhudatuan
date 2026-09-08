export const reportLabels = Object.freeze({ sales: '销售总览', products: '商品销售', malls: '商城销售', categories: '分类销售', channels: '渠道销售', members: '客户 / 会员分层', voucher: '卡券消费' } as const);
export const periodLabels = Object.freeze({ realtime: '实时', yesterday: '昨日', '7days': '近 7 日', '30days': '近 30 日' } as const);

export function dimensionText(dimensions: readonly Readonly<{ name: string; value: string }>[]): string {
  return dimensions.map(({ name, value }) => `${name}：${value}`).join(' · ') || '全部';
}
