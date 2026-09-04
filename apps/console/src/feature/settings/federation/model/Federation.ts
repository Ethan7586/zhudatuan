import type { OperationOutputFor } from '@shop/contract';

type FederationProviderDto = OperationOutputFor<'identity.providers.center.read'>['items'][number];
export type FederationType = FederationProviderDto['type'];
export interface FederationProvider {
  readonly id: string;
  readonly type: FederationType;
  readonly status: FederationProviderDto['status'];
}
export interface FederationCenter {
  readonly items: readonly FederationProvider[];
  readonly count: number;
}
export interface FederationHealth {
  readonly provider: string;
  readonly status: OperationOutputFor<'identity.providers.test'>['status'];
  readonly checkedAt: string;
}
