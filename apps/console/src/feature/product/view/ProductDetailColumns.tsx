import { chineseDomainLabel, chineseReference, presentProductPoolKind, presentProductStatus, presentProductTimelineReference } from '@shop/presentation';
import type { DataColumn } from '@shop/design';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { ProductDetail } from '../model/Product';

type Sku = ProductDetail['skus'][number];
type Stock = ProductDetail['inventory'][number];
type Price = ProductDetail['prices'][number];
type Qualification = ProductDetail['qualifications'][number];
type Channel = ProductDetail['channels'][number];
type Pool = ProductDetail['pools'][number];
type Timeline = ProductDetail['timeline'][number];

export const skuColumns: readonly DataColumn<Sku>[] = Object.freeze([
  { key: 'code', label: '商品规格编码', render: (row) => chineseReference('规格', row.code) },
  { key: 'specifications', label: '规格', render: (row) => row.specifications.map((item) => `${item.name}：${item.value}`).join(' · ') || '标准规格' },
  { key: 'status', label: '状态', render: (row) => presentProductStatus(row.status).label },
  { key: 'version', label: '版本', render: (row) => `第 ${formatInteger(row.version)} 版` },
]);

export const priceColumns: readonly DataColumn<Price>[] = Object.freeze([
  { key: 'sku', label: '商品规格', render: (row) => chineseReference('规格', row.sku) },
  { key: 'scope', label: '价格范围', render: (row) => chineseReference('价格范围', row.scope) },
  { key: 'price', label: '当前售价', render: (row) => formatDatabaseMinor(row.amountMinor, row.currency) },
  { key: 'compare', label: '划线价', render: (row) => (row.compareMinor === null ? '—' : formatDatabaseMinor(row.compareMinor, row.currency)) },
  { key: 'status', label: '价格簿状态', render: (row) => chineseDomainLabel(row.bookStatus) },
  { key: 'effective', label: '生效时间', render: (row) => formatDate(row.effectiveAt) },
  { key: 'expires', label: '失效时间', render: (row) => formatDate(row.expiresAt) },
]);

export const stockColumns: readonly DataColumn<Stock>[] = Object.freeze([
  { key: 'sku', label: '商品规格', render: (row) => chineseReference('规格', row.sku) },
  { key: 'scope', label: '库存范围', render: (row) => chineseReference('库存范围', row.scope) },
  { key: 'location', label: '库位', render: (row) => chineseReference('库位', row.location) },
  { key: 'onhand', label: '在手库存', render: (row) => formatInteger(row.onhand) },
  { key: 'safety', label: '安全库存', render: (row) => formatInteger(row.safety) },
  { key: 'saleable', label: '可售库存', render: (row) => formatInteger(Math.max(0, Number(row.onhand) - Number(row.safety))) },
  { key: 'status', label: '状态', render: (row) => chineseDomainLabel(row.status) },
]);

export const qualificationColumns: readonly DataColumn<Qualification>[] = Object.freeze([
  { key: 'listing', label: '商城投放', render: (row) => chineseReference('投放', row.listing) },
  { key: 'eligible', label: '当前结论', render: (row) => (row.eligible ? '符合售卖资格' : '暂不符合售卖资格') },
  { key: 'version', label: '规则版本', render: (row) => (row.policyVersion === 0 ? '无适用限制' : `第 ${row.policyVersion} 版`) },
]);

export const channelColumns: readonly DataColumn<Channel>[] = Object.freeze([
  { key: 'provider', label: '渠道', render: (row) => chineseDomainLabel(row.provider) },
  { key: 'external', label: '渠道商品编号', render: (row) => chineseReference('渠道商品', row.externalId) },
  { key: 'status', label: '映射状态', render: (row) => presentProductStatus(row.status).label },
  { key: 'version', label: '来源版本', render: (row) => chineseReference('来源版本', row.sourceVersion) },
  { key: 'observed', label: '最近同步', render: (row) => formatDate(row.observedAt) },
]);

export const poolColumns: readonly DataColumn<Pool>[] = Object.freeze([
  { key: 'name', label: '商品池', render: (row) => row.name },
  { key: 'kind', label: '类型', render: (row) => presentProductPoolKind(row.kind) },
  { key: 'status', label: '状态', render: (row) => presentProductStatus(row.status).label },
  { key: 'count', label: '商城投放数', render: (row) => formatInteger(row.listingCount) },
]);

export const timelineColumns: readonly DataColumn<Timeline>[] = Object.freeze([
  { key: 'time', label: '时间', render: (row) => formatDate(row.occurredAt) },
  { key: 'event', label: '变更', render: (row) => row.title },
  { key: 'reference', label: '业务对象', render: (row) => (row.reference === null ? '—' : chineseReference(presentProductTimelineReference(row.kind), row.reference)) },
]);

export function formatInteger(value: number | string): string {
  const normalized = String(value);
  if (!/^-?\d+$/.test(normalized)) return '—';
  const sign = normalized.startsWith('-') ? '-' : '';
  const digits = sign === '' ? normalized : normalized.slice(1);
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function formatDatabaseMinor(value: number | string, currency: string): string {
  const normalized = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(normalized) ? formatMinor(normalized, currency) : `${formatInteger(value)} ${currency} 分`;
}
