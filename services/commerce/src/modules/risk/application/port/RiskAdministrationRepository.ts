import type { ContractJsonValue } from '@shop/contract';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface RiskCenterRecord extends Record<string, unknown> {
  readonly id: string;
}

export interface RiskCaseRecord {
  readonly id: string;
  readonly state: 'open' | 'reviewing' | 'cleared' | 'confirmed' | 'closed';
  readonly actor: string | null;
  readonly version: number;
}

export interface RiskAdministrationRepository {
  center(context: ReadTransactionContext, scope: string, cursor: string | null, fetch: number): Promise<readonly RiskCenterRecord[]>;
  savePolicy(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; name: string; rule: ContractJsonValue; ruleHash: string; rolloutPercent: number; actor: string; expectedVersion: number }>
  ): Promise<Readonly<Record<string, unknown>> | null>;
  activatePolicy(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; candidateVersion: number; rolloutPercent: number; actor: string; expectedVersion: number }>): Promise<Readonly<Record<string, unknown>> | null>;
  retirePolicy(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; expectedVersion: number }>): Promise<Readonly<Record<string, unknown>> | null>;
  riskCase(context: WriteTransactionContext, id: string, scope: string): Promise<RiskCaseRecord | null>;
  reviewCase(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; state: string; reviewer: string; reason: string; evidence: Readonly<Record<string, unknown>>; expectedVersion: number }>
  ): Promise<Readonly<Record<string, unknown>> | null>;
}
