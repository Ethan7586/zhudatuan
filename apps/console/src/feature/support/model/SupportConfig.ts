import type { OperationBodyFor, OperationOutputFor } from '@shop/contract';
import type { TicketPriority, TicketChannel } from './Ticket';

type AccountDto = OperationOutputFor<'support.accounts.read'>['items'][number];
type RuleDto = OperationOutputFor<'support.rules.read'>['items'][number];
export interface AgentChange {
  readonly membership: string;
  readonly skills: readonly string[];
  readonly capacity: number;
  readonly state: OperationBodyFor<'SupportAgentsManageInput'>['state'];
}
export interface AccountChange {
  readonly provider: TicketChannel;
  readonly displayName: string;
  readonly secretRef?: string | null;
  readonly state: NonNullable<OperationBodyFor<'SupportAccountsManageInput'>['state']>;
}
export interface RuleChange {
  readonly name: string;
  readonly skill: string;
  readonly priorities: readonly TicketPriority[];
  readonly weight: number;
  readonly state: OperationBodyFor<'SupportRulesManageInput'>['state'];
}
export type SlaChange = Readonly<OperationBodyFor<'SupportSlasManageInput'>>;

export interface Account {
  readonly id: string;
  readonly provider: TicketChannel;
  readonly displayName: string;
  readonly state: AccountDto['state'];
  readonly validationState: AccountDto['validation_state'];
  readonly validationCode: string;
  readonly validatedAt: string | null;
  readonly version: number;
}
export interface Rule {
  readonly id: string;
  readonly name: string;
  readonly skill: string;
  readonly priorities: readonly TicketPriority[];
  readonly weight: number;
  readonly state: RuleDto['state'];
  readonly version: number;
  readonly updatedAt: string;
}
export interface Sla {
  readonly id: string;
  readonly priority: TicketPriority;
  readonly responseSeconds: number;
  readonly resolutionSeconds: number;
  readonly reopenSeconds: number;
  readonly version: number;
}
export interface ConfigPage<T> {
  readonly items: readonly T[];
  readonly count: number;
  readonly nextCursor?: string;
}
