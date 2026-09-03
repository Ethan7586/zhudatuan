import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { AccountChange, AgentChange, RuleChange, SlaChange } from '../model/SupportConfig';
import type { SupportPort } from '../public';

export class ManageSupportConfig {
  constructor(private readonly gateway: SupportPort) {}
  agent(context: ConsoleContext, id: string, version: number, body: AgentChange) { this.assert(context, 'support.agent.manage', 'support.agents.manage'); return this.gateway.manageAgent(context, id, version, body); }
  account(context: ConsoleContext, id: string, version: number, body: AccountChange) { this.assert(context, 'support.account.manage', 'support.accounts.manage'); return this.gateway.manageAccount(context, id, version, body); }
  rule(context: ConsoleContext, id: string, version: number, body: RuleChange) { this.assert(context, 'support.rule.manage', 'support.rules.manage'); return this.gateway.manageRule(context, id, version, body); }
  sla(context: ConsoleContext, id: string, version: number, body: SlaChange) { this.assert(context, 'support.sla.manage', 'support.slas.manage'); return this.gateway.manageSla(context, id, version, body); }

  private assert(context: ConsoleContext, permission: string, capability: string): void {
    if (context.session.assurance.level < 3) throw new Error('请先完成高强度身份验证。');
    if (!context.session.permissions.includes(permission) || !context.session.capabilities.includes(capability)) throw new Error('当前账号没有修改此配置的权限。');
  }
}
