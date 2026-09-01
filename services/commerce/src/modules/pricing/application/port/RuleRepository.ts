import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ContractJsonValue } from '@shop/contract';

export interface PriceRuleRecord extends Record<string, unknown> {
  readonly id: string;
  readonly scope_id: string;
  readonly priority: number;
  readonly kind: string;
  readonly condition: ContractJsonValue;
  readonly effect: ContractJsonValue;
  readonly version: number;
  readonly status: string;
  readonly effective_at: string | null;
}

export interface RuleRepository {
  create(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; priority: number; kind: string; condition: ContractJsonValue; effect: ContractJsonValue }>): Promise<PriceRuleRecord>;
  publish(context: WriteTransactionContext, id: string, expectedVersion: number | undefined): Promise<PriceRuleRecord | null>;
}
