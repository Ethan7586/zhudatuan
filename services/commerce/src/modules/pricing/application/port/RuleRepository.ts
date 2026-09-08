import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ContractJsonObject } from '@shop/contract';
import type { PricingRuleKind } from '../../domain/model/PricingRule';
export interface PriceRuleRecord extends Record<string, unknown> {
  readonly id: string;
  readonly scope_id: string;
  readonly priority: number;
  readonly kind: string;
  readonly condition: ContractJsonObject;
  readonly effect: ContractJsonObject;
  readonly version: number;
  readonly status: string;
  readonly effective_at: string;
  readonly expires_at: string | null;
  readonly approved_by: string | null;
}

export interface RuleRepository {
  create(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; priority: number; kind: PricingRuleKind; condition: ContractJsonObject; effect: ContractJsonObject; effectiveAt: string; expiresAt: string | null }>
  ): Promise<PriceRuleRecord>;
  publish(context: WriteTransactionContext, id: string, expectedVersion: number, approvedBy: string): Promise<PriceRuleRecord | null>;
}
