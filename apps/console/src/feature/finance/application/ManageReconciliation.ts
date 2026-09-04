import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { financeOperations, type FinanceReconciliationChange } from '../model/Finance';
import type { FinancePort } from '../public';

export class ManageReconciliation {
  constructor(private readonly port: Pick<FinancePort, 'manageReconciliation'>) {}
  execute(context: ConsoleContext, reconciliation: string, version: number, change: FinanceReconciliationChange, proof: string, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, financeOperations.manageReconciliation, proof);
    if (!context.session.csrf) throw new Error('安全会话已过期，请重新登录。');
    return this.port.manageReconciliation(context, reconciliation, version, change, proof, identity, signal);
  }
}
