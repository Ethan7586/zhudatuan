import { OP_FINANCE_POLICIES_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { FinancePort } from '../public';

export class ReadPolicies {
  constructor(private readonly port: Pick<FinancePort, 'policies'>) {}
  execute(context: ConsoleContext, cursor: string | undefined, signal?: AbortSignal) {
    assertOperationAccess(context, OP_FINANCE_POLICIES_READ);
    return this.port.policies(context, cursor, signal);
  }
}
