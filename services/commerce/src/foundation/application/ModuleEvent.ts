import type { JobKind } from './JobCatalog';

export interface ModuleEventSubscription {
  readonly handler: JobKind;
  readonly events: readonly string[];
}

export interface ModuleEvents {
  add(subscription: ModuleEventSubscription): void;
  handlers?(event: string): readonly string[];
}
