import { OP_RISK_POLICIES_MANAGE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { RiskPolicyCommand } from '../model/Command';
import type { RiskPort } from '../public';

export class ManageRiskPolicy {
  constructor(private readonly port: Pick<RiskPort, 'managePolicy'>) {}
  execute(context: ConsoleContext, command: RiskPolicyCommand, signal?: AbortSignal) {
    assertOperationAccess(context, OP_RISK_POLICIES_MANAGE, command.proof);
    return this.port.managePolicy(context, command, signal);
  }
}
