import { OP_SUPPORT_ACCOUNTS_MANAGE, OP_SUPPORT_AGENTS_MANAGE, OP_SUPPORT_RULES_MANAGE, OP_SUPPORT_SLAS_MANAGE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { AccountChange, AgentChange, RuleChange, SlaChange } from '../model/SupportConfig';
import type { SupportPort } from '../public';

export class ManageSupportConfig {
  constructor(private readonly gateway: SupportPort) {}
  agent(context: ConsoleContext, id: string, version: number, body: AgentChange) {
    this.assert(context, OP_SUPPORT_AGENTS_MANAGE);
    return this.gateway.manageAgent(context, id, version, body);
  }
  account(context: ConsoleContext, id: string, version: number, body: AccountChange) {
    this.assert(context, OP_SUPPORT_ACCOUNTS_MANAGE);
    return this.gateway.manageAccount(context, id, version, body);
  }
  rule(context: ConsoleContext, id: string, version: number, body: RuleChange) {
    this.assert(context, OP_SUPPORT_RULES_MANAGE);
    return this.gateway.manageRule(context, id, version, body);
  }
  sla(context: ConsoleContext, id: string, version: number, body: SlaChange) {
    this.assert(context, OP_SUPPORT_SLAS_MANAGE);
    return this.gateway.manageSla(context, id, version, body);
  }

  private assert(context: ConsoleContext, operation: typeof OP_SUPPORT_AGENTS_MANAGE | typeof OP_SUPPORT_ACCOUNTS_MANAGE | typeof OP_SUPPORT_RULES_MANAGE | typeof OP_SUPPORT_SLAS_MANAGE): void {
    assertOperationAccess(context, operation);
    if (!context.session.csrf) throw new Error('安全会话已过期，请重新登录。');
  }
}
