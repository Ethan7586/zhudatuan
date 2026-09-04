import type { OperationOutputFor } from '@shop/contract';

type AgentDto = OperationOutputFor<'support.agents.read'>['items'][number];

export interface Agent {
  readonly id: string;
  readonly membershipId: string;
  readonly skills: readonly string[];
  readonly capacity: number;
  readonly state: AgentDto['state'];
  readonly version: number;
}

export interface AgentPage {
  readonly items: readonly Agent[];
  readonly count: number;
  readonly nextCursor?: string;
}
