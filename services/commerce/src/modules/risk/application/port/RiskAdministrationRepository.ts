import type { ContractJsonValue } from '@shop/contract';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface RiskCenterRecord extends Record<string, unknown> {
  readonly id: string;
}

export interface RiskCaseRecord {
  readonly id: string;
  readonly state: 'open' | 'reviewing' | 'cleared' | 'confirmed' | 'closed';
  readonly actor: string | null;
}

export interface RiskAdministrationRepository {
  center(context: ReadTransactionContext, scope: string, cursor: string | null, fetch: number): Promise<readonly RiskCenterRecord[]>;
  savePolicy(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; name: string; rule: ContractJsonValue; ruleHash: string; rolloutPercent: number; actor: string }>): Promise<Readonly<Record<string, unknown>>>;
  activatePolicy(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; version: number; rolloutPercent: number; actor: string }>): Promise<Readonly<Record<string, unknown>>>;
  retirePolicy(context: WriteTransactionContext, id: string, scope: string): Promise<Readonly<Record<string, unknown>>>;
  riskCase(context: WriteTransactionContext, id: string, scope: string): Promise<RiskCaseRecord | null>;
  reviewCase(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; state: string; reviewer: string; reason: string; evidence: Readonly<Record<string, unknown>> }>): Promise<Readonly<Record<string, unknown>>>;
}
