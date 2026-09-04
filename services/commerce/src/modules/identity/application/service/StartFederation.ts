import { identityLifecycle as operationLifecycle, type IdentityLifecycle as OperationLifecycle } from '../model/IdentityAction';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import type { OperationRequest } from '../../../../foundation/application/OperationRequest';
import { requireWriteTransaction } from '../../../../foundation/persistence/TransactionContext';

import type { FederateIdentity, LoadedFederationStart, PreparedFederationStart } from '../service/FederateIdentity';
export class StartFederation {
  constructor(private readonly federation: FederateIdentity) {}
  lifecycle(): OperationLifecycle<PreparedFederationStart, LoadedFederationStart> {
    return operationLifecycle({
      load: (request, database) => this.federation.loadStart(database, provider(request)),
      prepare: (request, loaded) => {
        const body = bodyRecord(request.input);
        return this.federation.prepareStart(
          {
            provider: provider(request),
            returntarget: textField(body, 'returntarget', 2048),
            authorization: body.authorization,
            purpose: 'signin',
            principal: null,
            membership: null,
          },
          loaded,
          requestContext(request)
        );
      },
      execute: (_request, database, prepared) => this.federation.commitStart(requireWriteTransaction(database), prepared),
    });
  }
}
export function provider(request: OperationRequest): string {
  return textField(bodyRecord(request.input), 'providerid', 36);
}
export function requestContext(request: OperationRequest) {
  return Object.freeze({
    peer: request.input.headers['x-peer-address'] ?? 'unknown',
    agent: request.input.headers['user-agent'] ?? 'unknown',
    device: request.input.headers['x-device-id'] ?? 'browser',
    trace: request.input.headers['x-trace-id'] ?? request.input.idempotency ?? 'federation',
    signal: request.input.signal,
    deadline: request.input.deadline,
  });
}
