import type { OperationAction } from '../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../foundation/interface/Validation';
import { requireAccessNodeContext } from '../../../foundation/security/AccessContext';
import { memberPort } from '../01_public_gongkai/MemberPort';

export const sovereignUpgradeAction: OperationAction = async (request, database) => {
  const access = requireAccess(request);
  const nodeContext = requireAccessNodeContext(access);
  const body = bodyRecord(request);
  const upgraded = await memberPort.upgradeHostedMallToSovereign(database, {
    principal_id: access.actor.id,
    membership_id: access.membership.id,
    realm_id: access.actor.realm!,
    node_id: nodeContext.node_id,
  }, {
    idempotency_key: request.input.idempotency!,
    brand_ref: textField(body, 'brandRef', 512),
    public_api_host: textField(body, 'publicApiHost', 253),
    storefront_host: textField(body, 'storefrontHost', 253),
    accounts_host: textField(body, 'accountsHost', 253),
    console_host: textField(body, 'consoleHost', 253),
    payment_callback_host: textField(body, 'paymentCallbackHost', 253),
    edge_binding_ref: textField(body, 'edgeBindingRef', 512),
    tunnel_ref: textField(body, 'tunnelRef', 512),
    gateway_ref: textField(body, 'gatewayRef', 512),
    runtime_identity_ref: textField(body, 'runtimeIdentityRef', 512),
    data_scope_ref: textField(body, 'dataScopeRef', 512),
    secret_binding_set_ref: textField(body, 'secretBindingSetRef', 512),
    payment_binding_ref: textField(body, 'paymentBindingRef', 512),
    callback_binding_ref: textField(body, 'callbackBindingRef', 512),
    runtime_config_ref: textField(body, 'runtimeConfigRef', 512),
  });
  return { status: upgraded.replayed ? 200 : 201, body: upgraded };
};
