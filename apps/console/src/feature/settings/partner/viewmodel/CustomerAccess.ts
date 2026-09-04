import { OP_PARTNER_CUSTOMERS_CREATE, OP_PARTNER_CUSTOMERS_DISABLE, OP_PARTNER_CUSTOMERS_ENABLE, OP_PARTNER_CUSTOMERS_GET, OP_PARTNER_CUSTOMERS_LIST, OP_PARTNER_CUSTOMERS_UPDATE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../../shared/security/OperationAccess';

export function customerAccess(context: ConsoleContext) {
  return Object.freeze({
    canList: canUseOperation(context, OP_PARTNER_CUSTOMERS_LIST),
    canGet: canUseOperation(context, OP_PARTNER_CUSTOMERS_GET),
    canCreate: canUseOperation(context, OP_PARTNER_CUSTOMERS_CREATE),
    canUpdate: canUseOperation(context, OP_PARTNER_CUSTOMERS_UPDATE),
    canEnable: canUseOperation(context, OP_PARTNER_CUSTOMERS_ENABLE),
    canDisable: canUseOperation(context, OP_PARTNER_CUSTOMERS_DISABLE),
  });
}
