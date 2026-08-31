import type { IdentityProviderType } from '@shop/config/server';
import type { FederatedSubject } from '../../domain/model/FederatedSubject';
import type { ProviderInstance } from '../../domain/model/ProviderInstance';

export interface FederationStart {
  readonly instance: ProviderInstance;
  readonly state: string;
  readonly nonce: string;
  readonly challenge: string;
}
export interface FederationCallback {
  readonly instance: ProviderInstance;
  readonly code: string;
  readonly state: string;
  readonly noncehash: Buffer;
  readonly verifier: string;
  readonly signal?: AbortSignal | undefined;
  readonly deadline?: number | undefined;
}
export interface FederationRedirect {
  readonly location: string;
}
export interface ProviderHealth {
  readonly status: 'healthy' | 'degraded' | 'unavailable';
  readonly checkedat: string;
}
export interface FederatedIdentityProvider {
  readonly type: IdentityProviderType;
  start(input: FederationStart): Promise<FederationRedirect>;
  callback(input: FederationCallback): Promise<FederatedSubject>;
  health(instance: ProviderInstance): Promise<ProviderHealth>;
}
