import type { EventContract } from './EventContract';
import type { Operation } from './Operation';

export interface Contract {
  readonly version: 1;
  readonly operations: readonly Operation[];
  readonly events: readonly EventContract[];
}
