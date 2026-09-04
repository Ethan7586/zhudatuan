import type { OperationId } from '@shop/contract';
import { OP_PARTNER_CUSTOMERS_CREATE, OP_PARTNER_CUSTOMERS_DISABLE, OP_PARTNER_CUSTOMERS_ENABLE, OP_PARTNER_CUSTOMERS_UPDATE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { CustomerChange } from '../model/Customer';
import type { PartnerPort } from '../public';

export class ManageCustomer {
  constructor(private readonly port: Pick<PartnerPort, 'manageCustomer'>) {}
  execute(context: ConsoleContext, change: CustomerChange, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, customerOperation(change.kind));
    if (context.session.csrf === undefined) throw new Error('CSRF_TOKEN_INVALID');
    if (!identity) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    return this.port.manageCustomer(context, change, identity, signal);
  }
}

function customerOperation(kind: CustomerChange['kind']): OperationId {
  if (kind === 'create') return OP_PARTNER_CUSTOMERS_CREATE;
  if (kind === 'update') return OP_PARTNER_CUSTOMERS_UPDATE;
  return kind === 'enable' ? OP_PARTNER_CUSTOMERS_ENABLE : OP_PARTNER_CUSTOMERS_DISABLE;
}
