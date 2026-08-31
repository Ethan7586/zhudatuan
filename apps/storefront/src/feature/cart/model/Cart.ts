import type { CartLine } from './CartLine';

export interface Cart {
  readonly version: number;
  readonly lines: readonly CartLine[];
}
