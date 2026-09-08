import { PROVIDER_REQUIREMENTS } from '@shop/contract';
import type { Metric } from '../model/Metric';

export interface DimensionDefinition {
  readonly code: string;
  readonly name: string;
}

export interface DimensionPreset {
  readonly code: 'customermember';
  readonly name: string;
  readonly description: string;
  readonly dimensions: readonly ('customer' | 'member')[];
  readonly privacy: 'masked';
  readonly version: number;
  readonly owner: 'reporting';
  readonly reportDimension: 'member';
}

export interface DimensionOption {
  readonly value: string;
  readonly label: string;
}

export interface DisplayedDimension {
  readonly code: string;
  readonly name: string;
  readonly value: string;
}

export type DisplayedMetric<T extends Metric = Metric> = T & Readonly<{ displayedDimensions: readonly DisplayedDimension[] }>;

export const DIMENSION_DEFINITIONS = Object.freeze([
  Object.freeze({ code: 'mall', name: '商城' }),
  Object.freeze({ code: 'application', name: '商城应用' }),
  Object.freeze({ code: 'product', name: '商品' }),
  Object.freeze({ code: 'category', name: '商品分类' }),
  Object.freeze({ code: 'channel', name: '业务渠道' }),
  Object.freeze({ code: 'customer', name: '客户范围' }),
  Object.freeze({ code: 'member', name: '会员' }),
  Object.freeze({ code: 'voucherScope', name: '卡券所属范围' }),
  Object.freeze({ code: 'store', name: '门店' }),
  Object.freeze({ code: 'currency', name: '币种' }),
] satisfies readonly DimensionDefinition[]);

export const CUSTOMER_MEMBER_PRESET = Object.freeze({
  code: 'customermember',
  name: '客户 / 会员分层',
  description: '在当前授权客户范围内，按购买会员汇总成交金额与支付订单；只展示授权范围内的会员名称。',
  dimensions: Object.freeze(['customer', 'member'] as const),
  privacy: 'masked',
  version: 1,
  owner: 'reporting',
  reportDimension: 'member',
} satisfies DimensionPreset);

export const DIMENSION_PRESETS = Object.freeze([CUSTOMER_MEMBER_PRESET]);

const dimensionNames: ReadonlyMap<string, string> = new Map(DIMENSION_DEFINITIONS.map(({ code, name }) => [code, name]));
const channelNames = new Map([['internal', '自营商城'], ['order', '商城订单'], ['store', '门店核销'], ['manual', '人工核销'], ...PROVIDER_REQUIREMENTS.map(({ id, label }) => [id, label] as const)]);
const currencyNames = new Map([
  ['CNY', '人民币'],
  ['HKD', '港币'],
  ['USD', '美元'],
  ['EUR', '欧元'],
  ['JPY', '日元'],
]);

export function dimensionName(code: string): string {
  return dimensionNames.get(code) ?? '数据维度';
}

export function semanticDimensionValue(code: string, value: string): string | null {
  if (code === 'channel') return channelNames.get(value) ?? readable(value);
  if (code === 'currency') return currencyNames.get(value.toUpperCase()) ?? readable(value);
  return readable(value);
}

export function hiddenDimensionValue(code: string): string {
  if (code === 'application') return '已停用或无权查看的商城应用';
  if (code === 'mall') return '已停用或无权查看的商城';
  if (code === 'product') return '已停用或无权查看的商品';
  if (code === 'category') return '已停用或无权查看的分类';
  if (code === 'member') return '会员信息已隐藏';
  if (code === 'customer' || code === 'voucherScope') return '已停用或无权查看的客户范围';
  if (code === 'store') return '已停用或无权查看的门店';
  if (code === 'channel') return '其他业务渠道';
  if (code === 'currency') return '其他币种';
  return '已隐藏';
}

function readable(value: string): string | null {
  const normalized = value.normalize('NFKC').trim();
  return /[\u3400-\u9fff]/.test(normalized) && normalized.length <= 120 ? normalized : null;
}
