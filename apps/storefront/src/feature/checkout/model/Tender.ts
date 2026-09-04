import type { OperationOutputFor } from '@shop/contract';

export interface Tender {
  readonly kind: OperationOutputFor<'checkout.quote.create'>['tenders'][number]['kind'];
  readonly reference: string | null;
  readonly amountMinor: number;
}
