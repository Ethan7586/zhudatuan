import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { DirectoryConnection, DirectoryConnectionValue } from '../../domain/model/DirectoryConnection';
import type { SyncMode, SyncRun } from '../../domain/model/SyncRun';

export interface OrganizationRepository {
  layers(context: ReadTransactionContext, input: Readonly<{ scope: string; after: string | null; fetch: number }>): Promise<readonly Readonly<Record<string, unknown>>[]>;
  directories(context: ReadTransactionContext, scope: string, after: string | null, fetch: number): Promise<readonly Readonly<Record<string, unknown>>[]>;
  directory(context: ReadTransactionContext, id: string): Promise<DirectoryConnection>;
  lockDirectory(context: WriteTransactionContext, id: string): Promise<DirectoryConnection>;
  webhookDirectory(context: ReadTransactionContext, id: string): Promise<DirectoryConnection>;
  saveDirectory(context: WriteTransactionContext, value: DirectoryConnectionValue, expectedVersion: number): Promise<DirectoryConnection>;
  runs(context: ReadTransactionContext, connection: string, after: string | null, fetch: number): Promise<readonly Readonly<Record<string, unknown>>[]>;
  createRun(context: WriteTransactionContext, connection: string, mode: SyncMode, key: string): Promise<SyncRun>;
  receive(context: WriteTransactionContext, input: Readonly<{ connection: string; eventid: string; version: number; bodyhash: string; payload: string }>): Promise<'accepted' | 'duplicate' | 'stale'>;
}
