import { identityLifecycle as operationLifecycle, type IdentityLifecycle as OperationLifecycle } from '../model/IdentityAction';
import { DomainError } from '../../../../platform/error/DomainError';
import type { OperationRequest } from '../../../../pipeline/OperationRequest';
import { requireWriteTransaction } from '../../../../platform/database/TransactionContext';

import type { FederateIdentity, FederationCallbackInput, LoadedFederationCallback, PreparedFederationCallback } from '../service/FederateIdentity';
import { requestContext } from './StartFederation';
export class CompleteFederation {
  constructor(private readonly federation: FederateIdentity) {}
  lifecycle(): OperationLifecycle<PreparedFederationCallback, LoadedFederationCallback> {
    return operationLifecycle({
      load: (request, database) => this.federation.loadCallback(database, callback(request), requestContext(request)),
      prepare: (request, loaded) => this.federation.prepareCallback(callback(request), loaded, requestContext(request)),
      execute: (_request, database, prepared) => this.federation.commitCallback(requireWriteTransaction(database), prepared),
    });
  }
}
function callback(request: OperationRequest): FederationCallbackInput {
  const provider = request.input.path.providerid;
  if (!/^[0-9a-f-]{36}$/.test(provider ?? '')) throw new DomainError('VALIDATION_FAILED');
  return Object.freeze({ provider: provider!, state: query(request, 'state', 256), code: query(request, 'code', 512) });
}
function query(request: OperationRequest, key: string, maximum: number): string {
  const value = request.input.query[key];
  if (typeof value !== 'string' || !value || value.length > maximum || !/^[A-Za-z0-9._~-]+$/.test(value)) throw new DomainError('VALIDATION_FAILED');
  return value;
}
