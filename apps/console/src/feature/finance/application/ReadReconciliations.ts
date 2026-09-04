import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { FinanceReconciliationQuery } from '../model/Finance';
import type { FinancePort } from '../public';

export class ReadReconciliations {
  constructor(private readonly port: Pick<FinancePort, 'reconciliations'>) {}
  execute(context: ConsoleContext, query: FinanceReconciliationQuery, signal: AbortSignal) {
    return this.port.reconciliations(context, query, signal);
  }
}
