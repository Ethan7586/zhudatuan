import { DomainError } from '../../../../foundation/domain/DomainError';

export type FavoriteVisibilityReason = 'removed' | 'unpublished' | 'outofscope' | 'unavailable' | null;

export interface FavoriteVisibility {
  readonly listing: string;
  readonly visible: boolean;
  readonly reason: FavoriteVisibilityReason;
}

const EXPLANATIONS: Readonly<Record<Exclude<FavoriteVisibilityReason, null>, string>> = Object.freeze({
  removed: '商品已删除，可取消收藏',
  unpublished: '商品已下架，可取消收藏',
  outofscope: '商品不在当前商城销售，可切换商城后查看',
  unavailable: '商品暂不可用，可稍后再看',
});

export class FavoritePolicy {
  assertVisible(visibility: FavoriteVisibility): void {
    if (!visibility.visible) throw new DomainError('RESOURCE_NOT_FOUND');
  }

  availability(visibility: FavoriteVisibility): Readonly<{ available: boolean; reason: string | null }> {
    if (visibility.visible) return Object.freeze({ available: true, reason: null });
    return Object.freeze({ available: false, reason: EXPLANATIONS[visibility.reason ?? 'unavailable'] });
  }
}
