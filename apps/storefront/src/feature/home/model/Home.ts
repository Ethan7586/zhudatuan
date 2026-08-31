import type { HomeSection } from './HomeSection';

export interface Home {
  readonly release: string;
  readonly version: string;
  readonly hash: string;
  readonly effectiveAt: string;
  readonly sections: readonly HomeSection[];
}
