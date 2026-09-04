import { OP_FINANCE_STATEMENTIMPORTS_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { FinancePort } from '../public';

export class ReadFinanceImport {
  constructor(private readonly port: Pick<FinancePort, 'readImport'>) {}

  execute(context: ConsoleContext, id: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_FINANCE_STATEMENTIMPORTS_READ);
    if (!id.trim()) throw new Error('VALIDATION_FAILED');
    return this.port.readImport(context, id, signal);
  }
}
