import { OP_FINANCE_FACETS_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { FinancePort } from '../public';

export class ReadFacets {
  constructor(private readonly port: Pick<FinancePort, 'facets'>) {}

  execute(context: ConsoleContext, signal?: AbortSignal) {
    assertOperationAccess(context, OP_FINANCE_FACETS_READ);
    return this.port.facets(context, signal);
  }
}
