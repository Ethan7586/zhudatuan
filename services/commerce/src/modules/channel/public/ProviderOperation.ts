import type { ProviderOperationKind, ProviderOperationResult, ProviderOperationState } from '@shop/contract';

export interface ProviderOperationInput {
  readonly id: string;
  readonly provider: string;
  readonly scope: string;
  readonly kind: ProviderOperationKind;
  readonly idempotency: string;
  readonly reference: string;
  readonly state: ProviderOperationState;
  readonly requestHash: string;
  readonly result: ProviderOperationResult | null;
}

export interface ProviderOperationUpdate {
  readonly provider: string;
  readonly kind: ProviderOperationKind;
  readonly idempotency: string;
  readonly state: ProviderOperationState;
  readonly result: ProviderOperationResult | null;
}
