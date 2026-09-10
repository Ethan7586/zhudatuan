import type { Listing } from './Product';
import { isManagedListing, isPublishedListing } from './ProductAction';

export type ProductJourneyAction = 'detail' | 'pool' | 'deliver' | 'price' | 'inventory' | 'qualification' | 'publish';

export interface ProductJourneyNext {
  readonly action: ProductJourneyAction;
  readonly label: string;
  readonly detail: string;
}

export interface ProductJourney {
  readonly title: string;
  readonly steps: readonly ProductJourneyStep[];
  readonly next: ProductJourneyNext;
  readonly complete: boolean;
}

export interface ProductJourneyStep {
  readonly title: string;
  readonly detail: string;
  readonly state: 'pending' | 'current' | 'complete' | 'blocked';
}

export function productJourney(listing: Listing): ProductJourney {
  if (!isManagedListing(listing)) return sourceJourney();
  const hasProduct = nonempty(listing.product_id);
  const pooled = nonempty(listing.pool_id);
  const delivered = listing.mall_count > 0;
  const priced = positive(listing.price_amount_minor);
  const stocked = positive(listing.saleable_stock);
  const qualified = listing.qualification_eligible === true;
  const ready = priced && stocked && qualified;
  const published = isPublishedListing(listing.status);
  const completed = [hasProduct, pooled, delivered, ready, published] as const;
  const current = completed.findIndex((value) => !value);
  const state = (index: number): ProductJourneyStep['state'] => (completed[index] ? 'complete' : index === current ? 'current' : 'pending');
  const gaps = [priced ? undefined : '售价', stocked ? undefined : '库存', qualified ? undefined : '售卖资格'].filter((value): value is string => value !== undefined);
  const steps = Object.freeze([
    Object.freeze({ title: '商品资料', detail: hasProduct ? '名称、分类与商品主档已保存。' : '先保存商品名称、分类、类型和图片。', state: state(0) }),
    Object.freeze({ title: '关联商品池', detail: pooled ? `已加入“${listing.pool_name ?? '当前商品池'}”。` : '选择一个商品池，统一管理商品供给。', state: state(1) }),
    Object.freeze({ title: '投放商城', detail: delivered ? `已覆盖 ${listing.mall_count} 个商城。` : '选择目标商城，让商城获得该池商品。', state: state(2) }),
    Object.freeze({ title: '销售条件', detail: ready ? '售价、可售库存和资格均已满足。' : `还需完成${gaps.join('、') || '销售条件'}。`, state: state(3) }),
    Object.freeze({ title: '确认上架', detail: published ? '商品已对消费者可见。' : '完成检查后上架，消费者才会看到商品。', state: state(4) }),
  ] satisfies readonly ProductJourneyStep[]);
  const next = nextAction({ hasProduct, pooled, delivered, priced, stocked, qualified, published });
  return Object.freeze({ title: published ? '商品已完成上架' : `当前：${next.label}`, steps, next, complete: published });
}

function nextAction(readiness: Readonly<{ hasProduct: boolean; pooled: boolean; delivered: boolean; priced: boolean; stocked: boolean; qualified: boolean; published: boolean }>): ProductJourneyNext {
  if (!readiness.hasProduct) return Object.freeze({ action: 'detail', label: '查看商品映射', detail: '该渠道商品尚未映射到商品主档，请先查看来源与映射状态。' });
  if (!readiness.pooled) return Object.freeze({ action: 'pool', label: '加入商品池', detail: '只需选择一个商品池，保存后系统会自动带你进入商城投放。' });
  if (!readiness.delivered) return Object.freeze({ action: 'deliver', label: '投放到商城', detail: '当前商品池尚未提供给商城，请选择一个目标商城。' });
  if (!readiness.priced) return Object.freeze({ action: 'price', label: '设置售价', detail: '填写消费者看到的销售价格。' });
  if (!readiness.stocked) return Object.freeze({ action: 'inventory', label: '补充库存', detail: '直接填写本次入库数量，完成后继续检查售卖资格。' });
  if (!readiness.qualified) return Object.freeze({ action: 'qualification', label: '完善售卖资格', detail: '进入资格中心补齐并发布该商品的售卖资格。' });
  if (!readiness.published) return Object.freeze({ action: 'publish', label: '确认上架', detail: '所有销售条件已满足，确认后商品将对消费者可见。' });
  return Object.freeze({ action: 'detail', label: '查看完整详情', detail: '商品已上架，可查看权威详情、商城覆盖和变更记录。' });
}

function sourceJourney(): ProductJourney {
  const steps = Object.freeze([
    Object.freeze({ title: '商品资料', detail: '渠道商品尚未映射到商品主档。', state: 'blocked' as const }),
    Object.freeze({ title: '关联商品池', detail: '完成商品映射后继续。', state: 'pending' as const }),
    Object.freeze({ title: '投放商城', detail: '完成商品池关联后继续。', state: 'pending' as const }),
    Object.freeze({ title: '销售条件', detail: '完成商城投放后检查。', state: 'pending' as const }),
    Object.freeze({ title: '确认上架', detail: '满足全部条件后继续。', state: 'pending' as const }),
  ] satisfies readonly ProductJourneyStep[]);
  const next = Object.freeze({ action: 'detail', label: '查看商品映射', detail: '该渠道商品尚未映射到商品主档，请先查看来源与映射状态。' } as const);
  return Object.freeze({ title: '当前：等待商品映射', steps, next, complete: false });
}

function nonempty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function positive(value: string | number | null | undefined): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}
