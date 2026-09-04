import type { OperationId } from '@shop/contract';

export interface SessionCommandContext {
  readonly accessVersion: number;
  readonly csrf?: string;
  readonly idempotencyKey: string;
}

export interface StepupAction {
  readonly operation: OperationId;
  readonly resource: string;
  readonly requestHash: string;
  readonly expectedVersion: number;
  readonly makerMembership: string;
}

export interface StepupChallenge {
  readonly id: string;
  readonly actionBound: boolean;
}

export type StepupResult = Readonly<{ assurance: number }> | Readonly<{ assurance: number; proof: string; expiresAt: string }>;
