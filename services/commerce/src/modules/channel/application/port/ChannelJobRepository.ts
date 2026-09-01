import type { JsonObject } from '@shop/contract';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export type ChannelSyncKind = 'catalogsync' | 'pricesync' | 'inventorysync' | 'statementsync';

export interface ChannelSyncRun {
  readonly run: string;
  readonly connection: string;
  readonly provider: string;
  readonly scope: string;
  readonly connectionVersion: number;
  readonly region: string;
  readonly kind: 'catalog' | 'price' | 'stock' | 'statement';
  readonly cursor: string | null;
  readonly input: JsonObject;
}

export interface ChannelJobRepository {
  claim(context: WriteTransactionContext, run: string): Promise<ChannelSyncRun | undefined>;
  providerTenant(context: ReadTransactionContext, scope: string): Promise<string>;
  saveSource(context: WriteTransactionContext, input: Readonly<{ provider: string; scope: string; external: string; version: string; payload: JsonObject }>): Promise<void>;
  saveStatement(
    context: WriteTransactionContext,
    input: Readonly<{
      id: string;
      connection: string;
      provider: string;
      scope: string;
      partner: string;
      start: string;
      end: string;
      timezone: string;
      objectReference: string;
      sha256: string;
    }>
  ): Promise<void>;
  scheduleReconciliation(context: WriteTransactionContext, reconciliation: string, scope: string): Promise<void>;
  finish(
    context: WriteTransactionContext,
    input: Readonly<{
      run: ChannelSyncRun;
      job: ChannelSyncKind;
      owner: 'catalog' | 'pricing' | 'inventory' | 'finance';
      trace: string;
      accepted: number;
      rejected: number;
      complete: boolean;
      cursor: string | null;
      errors: readonly unknown[];
    }>
  ): Promise<void>;
}

export interface ChannelWebhookRecord {
  readonly id: string;
  readonly connection: string;
  readonly provider: string;
  readonly scope: string;
  readonly external: string;
  readonly attempts: number;
  readonly ciphertext: string;
  readonly rawHash: string;
  readonly signatureHash: string;
  readonly trace: string;
}

export interface ChannelWebhookRepository {
  claim(context: WriteTransactionContext, webhook: string): Promise<ChannelWebhookRecord | null>;
  apply(
    context: WriteTransactionContext,
    webhook: ChannelWebhookRecord,
    normalized: Readonly<Record<string, unknown>>,
    eventType: string,
    reference: string | null,
    kind: string,
    state: 'processing' | 'succeeded' | 'failed' | 'unknown'
  ): Promise<void>;
}
