import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { DirectoryConnection, DirectoryConnectionValue } from '../../domain/model/DirectoryConnection';
import type { DirectoryPage } from './DirectoryProvider';
import type { SyncMode, SyncRun } from '../../domain/model/SyncRun';

export interface DirectoryRepository {
  list(database: OperationDatabase, scope: string, after: string | null, limit: number): Promise<readonly Readonly<Record<string, unknown>>[]>;
  require(database: OperationDatabase, id: string, lock?: boolean): Promise<DirectoryConnection>;
  requireWebhook(database: OperationDatabase, id: string): Promise<DirectoryConnection>;
  save(database: OperationDatabase, value: DirectoryConnectionValue, expected: number): Promise<DirectoryConnection>;
  runs(database: OperationDatabase, connection: string, after: string | null, limit: number): Promise<readonly Readonly<Record<string, unknown>>[]>;
  createRun(database: OperationDatabase, connection: string, mode: SyncMode, key: string): Promise<SyncRun>;
  startRun(database: OperationDatabase, run: string): Promise<SyncRun>;
  event(database: OperationDatabase, run: string): Promise<Readonly<{ eventid: string; envelope: string }>>;
  stage(database: OperationDatabase, run: SyncRun, page: DirectoryPage, subjects: readonly StagedSubject[]): Promise<boolean>;
  current(database: OperationDatabase, connection: string, hashes: readonly Buffer[]): Promise<ReadonlyMap<string, CurrentDirectorySubject>>;
  apply(database: OperationDatabase, connection: DirectoryConnection, subject: StagedSubject, kind: DirectoryApplyKind): Promise<void>;
  advance(database: OperationDatabase, run: string, page: DirectoryPage, counts: DirectoryCounts): Promise<void>;
  complete(database: OperationDatabase, run: string, connection: string, version: number, cursor: string | null): Promise<void>;
  departures(database: OperationDatabase, connection: string): Promise<readonly DirectoryDeparture[]>;
  freeze(database: OperationDatabase, connection: string, subject: string): Promise<void>;
  fail(database: OperationDatabase, run: string, code: string): Promise<void>;
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
