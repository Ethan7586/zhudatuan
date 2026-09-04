import { OP_FINANCE_RECONCILIATIONS_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { FinanceReconciliationQuery } from '../model/Finance';
import type { FinancePort } from '../public';

export class ReadReconciliations {
  constructor(private readonly port: Pick<FinancePort, 'reconciliations'>) {}
  execute(context: ConsoleContext, query: FinanceReconciliationQuery, signal: AbortSignal) {
    assertOperationAccess(context, OP_FINANCE_RECONCILIATIONS_READ);
    return this.port.reconciliations(context, query, signal);
  }
}
