import type { OperationBodyFor, OperationOutputFor } from '@shop/contract';
import { OP_CATALOG_LISTINGS_PRICE_SET, OP_CATALOG_LISTINGS_PUBLISH, OP_CATALOG_LISTINGS_UNPUBLISH, OP_CATALOG_PRODUCTS_ARCHIVE, OP_CATALOG_PRODUCTS_CREATE, OP_CATALOG_PRODUCTS_UPDATE } from '@shop/contract/ids';

export type ProductStatus = NonNullable<OperationBodyFor<'CatalogProductsUpdateInput'>['status']>;
export type ProductType = NonNullable<OperationBodyFor<'CatalogProductsCreateInput'>['type']>;
export type ProductBatchAction = NonNullable<OperationBodyFor<'CatalogListingsBatchInput'>['action']>;
export type ProductPoolKind = OperationOutputFor<'catalog.pools.allocate'>['kind'];
type ProductBatchState = OperationOutputFor<'catalog.listings.batch'>['items'][number]['state'];
type ProductMediaKind = OperationOutputFor<'catalog.product.detail.read'>['media'][number]['kind'];
type ProductTimelineKind = OperationOutputFor<'catalog.product.detail.read'>['timeline'][number]['kind'];
export type ProductActionOperation =
  | typeof OP_CATALOG_PRODUCTS_CREATE
  | typeof OP_CATALOG_PRODUCTS_UPDATE
  | typeof OP_CATALOG_PRODUCTS_ARCHIVE
  | typeof OP_CATALOG_LISTINGS_PRICE_SET
  | typeof OP_CATALOG_LISTINGS_PUBLISH
  | typeof OP_CATALOG_LISTINGS_UNPUBLISH;

export type ProductStatusView = Readonly<{
  label: string;
  tone: 'success' | 'warning' | 'info' | 'muted' | 'neutral';
  icon: 'check' | 'warning';
}>;

export type ProductActionView = Readonly<{
  title: string;
  submit: string;
  verb: string;
  impact: string;
}>;

const statusViews: Readonly<Record<string, ProductStatusView>> = Object.freeze({
  active: status('已启用', 'success', 'check'),
  available: status('已上架', 'success', 'check'),
  published: status('已上架', 'success', 'check'),
  mapped: status('已映射', 'success', 'check'),
  needs_attention: status('待处理', 'warning', 'warning'),
  incomplete: status('待完善', 'warning', 'warning'),
  rejected: status('已拒绝', 'warning', 'warning'),
  pending_listing: status('待上架', 'info', 'warning'),
  pending_review: status('待审核', 'info', 'warning'),
  pending: status('待处理', 'info', 'warning'),
  review: status('待审核', 'info', 'warning'),
  unpublished: status('已下架', 'muted', 'warning'),
  offline: status('已下架', 'muted', 'warning'),
  archived: status('已归档', 'muted', 'warning'),
  retired: status('已停用', 'muted', 'warning'),
  partial: status('部分上架', 'warning', 'warning'),
  draft: status('草稿', 'neutral', 'warning'),
});

const actionViews: Readonly<Record<ProductActionOperation, ProductActionView>> = Object.freeze({
  [OP_CATALOG_PRODUCTS_CREATE]: action('新建商品', '创建草稿', '新建', '创建可继续完善和投放的商品草稿'),
  [OP_CATALOG_PRODUCTS_UPDATE]: action('编辑商品', '保存修改', '编辑', '更新商品主档并产生新版本'),
  [OP_CATALOG_PRODUCTS_ARCHIVE]: action('归档商品', '确认归档', '归档', '停止后续销售，历史订单不受影响'),
  [OP_CATALOG_LISTINGS_PRICE_SET]: action('设置销售价', '创建并发布价格', '定价', '创建当前商城生效的销售价格'),
  [OP_CATALOG_LISTINGS_PUBLISH]: action('上架商品', '确认上架', '上架', '通过服务端校验后开放商品销售'),
  [OP_CATALOG_LISTINGS_UNPUBLISH]: action('下架商品', '确认下架', '下架', '停止新订单购买，历史订单不受影响'),
});

const statusOptions: Readonly<Record<ProductStatus, string>> = Object.freeze({ draft: '草稿', review: '待审核', active: '启用', archived: '归档' });
const typeOptions: Readonly<Record<ProductType, string>> = Object.freeze({ physical: '实物商品', virtual: '虚拟商品', service: '服务商品', voucher: '卡券商品' });
const poolKindViews: Readonly<Record<ProductPoolKind, string>> = Object.freeze({ global: '全局池', channel: '渠道池', private: '私有池', markup: '加价池' });
const batchStateViews: Readonly<Record<ProductBatchState, string>> = Object.freeze({ ready: '可执行', succeeded: '已完成', failed: '执行失败' });
const mediaKindViews: Readonly<Record<ProductMediaKind, Readonly<{ badge: string; title: string }>>> = Object.freeze({
  image: Object.freeze({ badge: '图片', title: '商品图片' }),
  video: Object.freeze({ badge: '视频', title: '商品视频' }),
  document: Object.freeze({ badge: '文档', title: '商品文档' }),
});
const gapViews: Readonly<Record<string, string>> = Object.freeze({
  pool_missing: '未加入商品池',
  pricing_unavailable: '价格服务暂不可用',
  inventory_unavailable: '库存服务暂不可用',
  qualification_unavailable: '资格服务暂不可用',
  price_missing: '缺少有效价格',
  inventory_missing: '缺少库存记录',
  qualification_failed: '经营资格未通过',
  PRODUCT_NOT_ACTIVE: '商品尚未启用',
  SKU_NOT_ACTIVE: 'SKU 尚未启用',
  POOL_NOT_ACTIVE: '商品池尚未启用',
  POOL_NOT_BOUND: '商品池未绑定当前商城',
  QUALIFICATION_INVALID: '经营资格未通过',
  PRICE_MISSING: '缺少有效售价',
  INVENTORY_UNAVAILABLE: '暂无可售库存',
  CHANNEL_UNAVAILABLE: '渠道商品尚未就绪',
  VERSION_CONFLICT: '商品版本已变化，请重新预检',
  RESOURCE_NOT_FOUND: '商品已不存在或当前范围不可见',
  LISTING_NOT_PURCHASABLE: '商品当前不可操作',
});

export const PRODUCT_STATUS_OPTIONS = options(statusOptions);
export const PRODUCT_TYPE_OPTIONS = options(typeOptions);

export function presentProductStatus(value: string): ProductStatusView {
  return statusViews[value] ?? status('其他状态', 'neutral', 'warning');
}

export function presentProductAction(operation: ProductActionOperation): ProductActionView {
  return actionViews[operation];
}

export function presentProductBatchAction(value: ProductBatchAction): string {
  return presentProductAction(value === 'publish' ? OP_CATALOG_LISTINGS_PUBLISH : OP_CATALOG_LISTINGS_UNPUBLISH).verb;
}

export function presentCatalogGap(value: string | null | undefined, fallback = '服务端未能处理该商品'): string {
  return value === null || value === undefined ? fallback : (gapViews[value] ?? fallback);
}

export function presentProductSource(source: string, partnerName: string | null | undefined): string {
  if (source === 'self') return '自营商品';
  if (partnerName?.trim()) return `供应商：${partnerName.trim()}`;
  if (source === 'supplier' || source === 'partner') return '供应商商品';
  if (source === 'private') return '私有渠道商品';
  return '外部渠道商品';
}

export function presentProductType(value: string): string {
  return typeOptions[value as ProductType] ?? '其他商品';
}

export function presentProductPoolKind(value: string): string {
  return poolKindViews[value as ProductPoolKind] ?? '其他商品池';
}

export function presentProductBatchState(value: ProductBatchState): string {
  return batchStateViews[value];
}

export function presentProductMediaKind(value: ProductMediaKind): Readonly<{ badge: string; title: string }> {
  return mediaKindViews[value];
}

export function presentProductTimelineReference(value: ProductTimelineKind): string {
  if (value === 'productcreated' || value === 'productupdated') return '商品';
  return value === 'sourceobserved' ? '渠道商品' : '投放';
}

export function isPublishedProduct(value: string): boolean {
  return value === 'published' || value === 'available';
}

export function editableProductStatus(value: OperationOutputFor<'catalog.product.detail.read'>['status'] | undefined): ProductStatus {
  return value ?? 'draft';
}

function status(label: string, tone: ProductStatusView['tone'], icon: ProductStatusView['icon']): ProductStatusView {
  return Object.freeze({ label, tone, icon });
}

function action(title: string, submit: string, verb: string, impact: string): ProductActionView {
  return Object.freeze({ title, submit, verb, impact });
}

function options<T extends string>(values: Readonly<Record<T, string>>): readonly Readonly<{ value: T; label: string }>[] {
  return Object.freeze((Object.keys(values) as T[]).map((value) => Object.freeze({ value, label: values[value] })));
}
