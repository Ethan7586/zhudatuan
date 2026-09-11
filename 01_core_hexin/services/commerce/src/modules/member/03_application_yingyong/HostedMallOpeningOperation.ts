import type { OperationAction } from '../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../foundation/interface/Validation';
import { requireAccessNodeContext } from '../../../foundation/security/AccessContext';
import { memberPort } from '../01_public_gongkai/MemberPort';

export const hostedMallOpeningAction: OperationAction = async (request, database) => {
  const access = requireAccess(request);
  const nodeContext = requireAccessNodeContext(access);
  const body = bodyRecord(request);
  const opened = await memberPort.openHostedMall(database, {
    principal_id: access.actor.id,
    membership_id: access.membership.id,
    realm_id: access.actor.realm!,
    node_id: nodeContext.node_id,
  }, {
    idempotency_key: request.input.idempotency!,
    mall_name: textField(body, 'mallName', 128),
    operating_entity_name: textField(body, 'operatingEntityName', 128),
  });
  return { status: opened.replayed ? 200 : 201, body: opened };
};
