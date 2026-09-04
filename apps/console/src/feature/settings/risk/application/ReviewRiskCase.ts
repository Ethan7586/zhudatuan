import { OP_RISK_CASES_REVIEW } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { RiskCaseCommand } from '../model/Command';
import type { RiskPort } from '../public';

export class ReviewRiskCase {
  constructor(private readonly port: Pick<RiskPort, 'reviewCase'>) {}
  execute(context: ConsoleContext, command: RiskCaseCommand, signal?: AbortSignal) {
    assertOperationAccess(context, OP_RISK_CASES_REVIEW, command.proof);
    return this.port.reviewCase(context, command, signal);
  }
}
