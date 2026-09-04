import { OP_RISK_CENTER_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { RiskPort } from '../public';

export class ReadRisk {
  constructor(private readonly port: Pick<RiskPort, 'read'>) {}
  execute(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_RISK_CENTER_READ);
    return this.port.read(context, cursor, signal);
  }
}
