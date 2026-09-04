import { OP_RISK_CASES_REVIEW, OP_RISK_POLICIES_MANAGE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { createActionRequest } from '../../../../shared/security/ActionRequest';
import { riskInput, type RiskCommand } from '../model/Command';

export class PrepareRisk {
  execute(context: ConsoleContext, command: RiskCommand): Promise<string> {
    const operation = command.kind === 'policy' ? OP_RISK_POLICIES_MANAGE : OP_RISK_CASES_REVIEW;
    return createActionRequest(operation, riskInput(command), command.change.expectedVersion, context.session.membership, context.scope.id);
  }
}
