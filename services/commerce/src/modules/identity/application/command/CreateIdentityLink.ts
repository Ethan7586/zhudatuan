import type { OperationAction } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import type { FederationService } from '../service/FederationService';
import { requestContext } from './StartFederation';
export class CreateIdentityLink {
  constructor(private readonly federation: FederationService) {}
  action(): OperationAction {
    return (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      return this.federation.startLink(
        database,
        {
          provider: textField(body, 'providerid', 36),
          returntarget: textField(body, 'returntarget', 2048),
          authorization: body.authorization,
          principal: access.actor.id,
          membership: access.membership.id,
          target: access.actor.target,
        },
        requestContext(request)
      );
    };
  }
}
