import { identityLifecycle as operationLifecycle, type IdentityLifecycle as OperationLifecycle } from '../model/IdentityAction';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireAccess } from '../../../../foundation/application/OperationAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { requireWriteTransaction } from '../../../../foundation/persistence/TransactionContext';
import type { FederateIdentity, LoadedFederationStart, PreparedFederationStart } from '../service/FederateIdentity';
import { provider, requestContext } from './StartFederation';
export class CreateIdentityLink {
  constructor(private readonly federation: FederateIdentity) {}
  lifecycle(): OperationLifecycle<PreparedFederationStart, LoadedFederationStart> {
    return operationLifecycle({
      load: (request, database) => this.federation.loadStart(database, provider(request)),
      prepare: (request, loaded) => {
        const access = requireAccess(request);
        const body = bodyRecord(request.input);
        const target = this.federation.returnTarget(textField(body, 'returntarget', 2048));
        if (target.target !== access.actor.target) throw new DomainError('FEDERATION_TRANSACTION_INVALID');
        return this.federation.prepareStart(
          {
            provider: provider(request),
            returntarget: textField(body, 'returntarget', 2048),
            authorization: body.authorization,
            purpose: 'link',
            principal: access.actor.id,
            membership: access.membership.id,
          },
          loaded,
          requestContext(request)
        );
      },
      execute: (_request, database, prepared) => this.federation.commitStart(requireWriteTransaction(database), prepared),
    });
  }
}
