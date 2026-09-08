import type { CacheState } from '../../../../platform/cache/Cache';
import type { NavigationKey } from '../../domain/model/NavigationKey';
import type { NavigationTree, NavigationTreeValue } from '../../domain/model/NavigationTree';

export interface NavigationCacheRepository {
  get(pointer: string): Promise<NavigationTree | null>;
  put(pointer: string, key: NavigationKey, tree: NavigationTreeValue): Promise<boolean>;
  accept(event: string, indexes: readonly string[]): Promise<boolean>;
  invalidate(indexes: readonly string[]): Promise<boolean>;
  state(): CacheState;
}

export interface NavigationInvalidationState {
  lastEventAt(): string | null;
}

export interface NavigationInvalidationPort extends NavigationInvalidationState {
  invalidate(
    value: Readonly<{
      event: string;
      principals?: readonly string[];
      memberships?: readonly string[];
      scopes?: readonly string[];
      targets?: readonly string[];
      catalog?: boolean;
    }>
  ): Promise<boolean>;
}
