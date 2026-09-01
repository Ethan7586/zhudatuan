import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

import type { DirectoryConnection, DirectoryConnectionValue } from '../../domain/model/DirectoryConnection';
import type { DirectoryPage } from './DirectoryProvider';
import type { SyncMode, SyncRun } from '../../domain/model/SyncRun';

export interface DirectoryRepository {
  list(context: ReadTransactionContext, scope: string, after: string | null, limit: number): Promise<readonly Readonly<Record<string, unknown>>[]>;
  require(context: ReadTransactionContext, id: string): Promise<DirectoryConnection>;
  lock(context: WriteTransactionContext, id: string): Promise<DirectoryConnection>;
  requireWebhook(context: ReadTransactionContext, id: string): Promise<DirectoryConnection>;
  save(context: WriteTransactionContext, value: DirectoryConnectionValue, expected: number): Promise<DirectoryConnection>;
  runs(context: ReadTransactionContext, connection: string, after: string | null, limit: number): Promise<readonly Readonly<Record<string, unknown>>[]>;
  createRun(context: WriteTransactionContext, connection: string, mode: SyncMode, key: string): Promise<SyncRun>;
  startRun(context: WriteTransactionContext, run: string): Promise<SyncRun>;
  event(context: ReadTransactionContext, run: string): Promise<Readonly<{ eventid: string; envelope: string }>>;
  stage(context: WriteTransactionContext, run: SyncRun, page: DirectoryPage, subjects: readonly StagedSubject[]): Promise<boolean>;
  current(context: ReadTransactionContext, connection: string, hashes: readonly Buffer[]): Promise<ReadonlyMap<string, CurrentDirectorySubject>>;
  apply(context: WriteTransactionContext, connection: DirectoryConnection, subject: StagedSubject, kind: DirectoryApplyKind): Promise<void>;
  advance(context: WriteTransactionContext, run: string, page: DirectoryPage, counts: DirectoryCounts): Promise<void>;
  complete(context: WriteTransactionContext, run: string, connection: string, version: number, cursor: string | null): Promise<void>;
  departures(context: ReadTransactionContext, connection: string): Promise<readonly DirectoryDeparture[]>;
  freeze(context: WriteTransactionContext, connection: string, subject: string): Promise<void>;
  markEventProcessed(context: WriteTransactionContext, connection: string, event: string): Promise<void>;
  fail(context: WriteTransactionContext, run: string, code: string): Promise<void>;
}
export interface StagedSubject {
  readonly id: string;
  readonly hash: Buffer;
  readonly type: 'user' | 'department';
  readonly status: 'active' | 'inactive' | 'conflict';
  readonly attributes: string | null;
  readonly sourceversion: number;
  readonly organization: string;
  readonly parentorganization: string | null;
  readonly displayname: string;
  readonly membership: string | null;
  readonly explicitdeparture: boolean;
}
export interface CurrentDirectorySubject {
  readonly id: string;
  readonly status: string;
  readonly sourceversion: number;
  readonly missingcount: number;
  readonly membership: string | null;
}
export interface DirectoryDeparture {
  readonly subject: string;
  readonly membership: string;
  readonly organization: string;
}
export type DirectoryApplyKind = 'create' | 'update' | 'freeze' | 'restore' | 'conflict';
export interface DirectoryCounts {
  readonly read: number;
  readonly applied: number;
  readonly conflicts: number;
  readonly ignored: number;
}
