import { OP_PARTNER_CUSTOMERS_GET } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { PartnerPort } from '../public';

export class ReadCustomer {
  constructor(private readonly port: Pick<PartnerPort, 'readCustomer'>) {}
  execute(context: ConsoleContext, id: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_PARTNER_CUSTOMERS_GET);
    return this.port.readCustomer(context, id, signal);
  }
}
