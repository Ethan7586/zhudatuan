import type { CacheState } from '../../../../foundation/cache/Cache';
import type { NavigationKey } from '../../domain/model/NavigationKey';
import type { NavigationTree, NavigationTreeValue } from '../../domain/model/NavigationTree';

export interface NavigationCache {
  get(pointer: string): Promise<NavigationTree | null>;
  put(pointer: string, key: NavigationKey, tree: NavigationTreeValue): Promise<boolean>;
  accept(event: string, indexes: readonly string[]): Promise<boolean>;
  invalidate(indexes: readonly string[]): Promise<boolean>;
  state(): CacheState;
}

export interface NavigationInvalidationState {
  lastEventAt(): string | null;
}
