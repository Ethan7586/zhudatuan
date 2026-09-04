import { OP_FINANCE_AUDIT_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { FinancePort } from '../public';

export class ReadFinanceAudit {
  constructor(private readonly port: Pick<FinancePort, 'audit'>) {}

  execute(context: ConsoleContext, reference: string, signal: AbortSignal) {
    assertOperationAccess(context, OP_FINANCE_AUDIT_READ);
    return this.port.audit(context, reference, signal);
  }
}
