import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface AfterSaleCandidate {
  readonly scope: string;
  readonly member: string;
  readonly line: string;
  readonly productType: string;
  readonly provider: string | null;
  readonly fulfilledAt: string | null;
  readonly fulfilledQuantity: number;
  readonly claimedQuantity: number;
  readonly requestedQuantity: number;
  readonly providerRule: Readonly<Record<string, unknown>>;
}
export interface AfterSaleDecision {
  readonly eligible: boolean;
  readonly requiresReturn: boolean;
  readonly maximumQuantity: number;
  readonly windowDays: number;
  readonly deadline: string | null;
  readonly unavailableReason: string | null;
  readonly policy: Readonly<{
    id: string;
    policyVersion: number;
    rule: Readonly<Record<string, unknown>>;
  }>;
}
export interface AfterSalePolicyPort {
  evaluate(context: ReadTransactionContext, candidate: AfterSaleCandidate): Promise<AfterSaleDecision>;
}
export const AFTERSALE_POLICY_PORT = publicPort<AfterSalePolicyPort>('qualification', 'aftersale');
