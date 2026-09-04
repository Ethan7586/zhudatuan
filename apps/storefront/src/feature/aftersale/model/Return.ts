import type { OperationOutputFor } from '@shop/contract';

export interface AfterSaleReturn {
  readonly id: string;
  readonly state: OperationOutputFor<'fulfillment.returns.receive'>['state'];
  readonly provider: string | null;
  readonly providerReference: string | null;
  readonly instruction: Readonly<Record<string, unknown>>;
  readonly trackingNumber: string | null;
}
