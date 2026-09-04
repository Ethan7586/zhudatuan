import type { NavigationContext } from '../../domain/model/NavigationContext';
import type { NavigationNodeValue } from '../../domain/model/NavigationNode';

export interface ConsumerNavigationSnapshot {
  readonly nodes: readonly NavigationNodeValue[];
  readonly version: string;
}

export interface ConsumerNavigationReader {
  readonly featureFlags: ReadonlySet<string>;
  read(context: NavigationContext): ConsumerNavigationSnapshot;
}
