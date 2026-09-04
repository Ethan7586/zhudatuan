import { OP_PARTNER_CUSTOMERS_LIST } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { CustomerQuery } from '../model/Customer';
import type { PartnerPort } from '../public';

export class ReadCustomers {
  constructor(private readonly port: Pick<PartnerPort, 'readCustomers'>) {}
  execute(context: ConsoleContext, query: CustomerQuery, signal?: AbortSignal) {
    assertOperationAccess(context, OP_PARTNER_CUSTOMERS_LIST);
    return this.port.readCustomers(context, query, signal);
  }
}
