import { OP_FINANCE_OVERVIEW_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { FinancePort } from '../public';

export class ReadOverview {
  constructor(private readonly port: Pick<FinancePort, 'overview'>) {}
  execute(context: ConsoleContext, signal: AbortSignal) {
    assertOperationAccess(context, OP_FINANCE_OVERVIEW_READ);
    return this.port.overview(context, signal);
  }
}
