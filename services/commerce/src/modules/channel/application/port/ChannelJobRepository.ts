import type { JsonObject, ProviderCapability } from '@shop/contract';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ConnectionState } from '../../domain/model/Connection';
import type { ChannelFailure } from '../../domain/model/Failure';
import type { SyncProgress } from '../../domain/model/SyncRun';

export type ChannelSyncKind = 'catalogsync' | 'pricesync' | 'inventorysync' | 'statementsync';

export interface ChannelSyncRun {
  readonly run: string;
  readonly connection: string;
  readonly provider: string;
  readonly scope: string;
  readonly connectionVersion: number;
  readonly runVersion: number;
  readonly connectionState: ConnectionState;
  readonly capabilities: readonly ProviderCapability[];
  readonly region: string;
  readonly kind: 'catalog' | 'price' | 'stock' | 'statement';
  readonly cursor: string | null;
  readonly inputHash: string;
  readonly progress: SyncProgress;
  readonly input: JsonObject;
}

export interface ChannelJobRepository {
  claim(context: WriteTransactionContext, run: string, scope: string): Promise<ChannelSyncRun | undefined>;
  beginApply(context: WriteTransactionContext, run: ChannelSyncRun): Promise<ChannelSyncRun>;
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
  fail(context: WriteTransactionContext, run: string, scope: string, failure: ChannelFailure): Promise<void>;
}
