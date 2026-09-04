import type { CipherEnvelope } from '../../../../foundation/application/KmsPort';
import type { FederatedSubject } from '../../domain/model/FederatedSubject';
import type { CreateFederation, FederationCallbackRecord } from '../port/FederationRepository';
import type { ProviderResolver } from './ProviderResolver';

export interface FederationRequestContext {
  readonly peer: string;
  readonly agent: string;
  readonly device: string;
  readonly trace: string;
  readonly signal?: AbortSignal;
  readonly deadline?: number;
}

export interface FederationStartInput {
  readonly provider: string;
  readonly returntarget: string;
  readonly authorization: unknown;
  readonly purpose: 'signin' | 'link';
  readonly principal: string | null;
  readonly membership: string | null;
}

type ResolvedFederationProvider = Awaited<ReturnType<ProviderResolver['require']>>;

export interface LoadedFederationStart {
  readonly provider: ResolvedFederationProvider;
}

export interface PreparedFederationStart {
  readonly creation: CreateFederation;
  readonly redirect: string;
}

export interface FederationCallbackInput {
  readonly provider: string;
  readonly state: string;
  readonly code: string;
}

export interface LoadedFederationCallback {
  readonly accepted: FederationCallbackRecord;
  readonly provider: ResolvedFederationProvider;
}

export interface PreparedFederationCallback {
  readonly loaded: LoadedFederationCallback;
  readonly subject: FederatedSubject;
  readonly subjecthash: Buffer;
  readonly envelope: CipherEnvelope;
  readonly request: FederationRequestContext;
}
