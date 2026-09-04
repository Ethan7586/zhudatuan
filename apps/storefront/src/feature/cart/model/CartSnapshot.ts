export interface CartSnapshotLine {
  readonly listing: string;
  readonly sku: string;
  readonly quantity: number;
  readonly selected: boolean;
  readonly version: number;
  readonly title: string;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly available: number | null;
  readonly benefitApplicable: boolean;
  readonly validity: CartOutput['items'][number]['validity'];
}

export interface CartSnapshot {
  readonly version: number;
  readonly merge: CartOutput['merge'];
  readonly mergeReason: string | null;
  readonly items: readonly CartSnapshotLine[];
}
import type { OperationOutputFor } from '@shop/contract';

type CartOutput = OperationOutputFor<'cart.current.read'>;
