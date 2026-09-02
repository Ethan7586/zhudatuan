import type { OperationOutputFor } from '@shop/contract';

export type AgentPage = OperationOutputFor<'support.agents.read'>;
export type Agent = AgentPage['items'][number];
