import type { OperationOutputFor } from '@shop/contract';

type SupportCaseDto = OperationOutputFor<'support.cases.read'>['items'][number];
export type SupportPriority = SupportCaseDto['priority'];
export type SupportState = SupportCaseDto['state'];

export interface SupportCase {
  readonly id: string;
  readonly conversationId: string;
  readonly subject: string;
  readonly priority: SupportPriority;
  readonly state: SupportState;
  readonly orderId: string | null;
  readonly assignedAgentId: string | null;
  readonly responseDueAt: string;
  readonly resolutionDueAt: string;
  readonly updatedAt: string;
  readonly version: number;
  readonly unreadCount: number;
  readonly slaRisk: SupportCaseDto['sla_risk'];
}

export interface SupportPage {
  readonly items: readonly SupportCase[];
  readonly nextCursor?: string;
}
