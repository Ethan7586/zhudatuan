export type SupportPriority = 'low' | 'normal' | 'high' | 'urgent';
export type SupportState = 'open' | 'assigned' | 'waiting' | 'resolved' | 'closed';

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
}

export interface SupportPage {
  readonly items: readonly SupportCase[];
  readonly nextCursor?: string;
}
