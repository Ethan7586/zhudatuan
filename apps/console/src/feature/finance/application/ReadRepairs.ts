import { OP_FINANCE_RECONCILIATIONREPAIRS_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { FinancePort } from '../public';

export class ReadRepairs {
  constructor(private readonly port: Pick<FinancePort, 'repairs'>) {}
  execute(context: ConsoleContext, cursor: string | undefined, signal?: AbortSignal) {
    assertOperationAccess(context, OP_FINANCE_RECONCILIATIONREPAIRS_READ);
    return this.port.repairs(context, cursor, signal);
  }
}
