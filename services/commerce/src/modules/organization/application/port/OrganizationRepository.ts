import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { DirectoryConnection, DirectoryConnectionValue } from '../../domain/model/DirectoryConnection';
import type { SyncMode, SyncRun } from '../../domain/model/SyncRun';
import type { Mall } from '../../domain/model/Mall';
import type { Membership } from '../../domain/model/Membership';
import type { Organization } from '../../domain/model/Organization';

export interface MallParentSnapshot {
  readonly organization: Organization;
  readonly visible: boolean;
  readonly activeMalls: number;
}

export interface OrganizationRepository {
  layers(context: ReadTransactionContext, input: Readonly<{ scope: string; after: string | null; fetch: number }>): Promise<readonly Readonly<Record<string, unknown>>[]>;
  directories(context: ReadTransactionContext, scope: string, after: string | null, fetch: number): Promise<readonly Readonly<Record<string, unknown>>[]>;
  directory(context: ReadTransactionContext, id: string): Promise<DirectoryConnection>;
  lockDirectory(context: WriteTransactionContext, id: string): Promise<DirectoryConnection>;
  webhookDirectory(context: ReadTransactionContext, id: string): Promise<DirectoryConnection>;
  saveDirectory(context: WriteTransactionContext, value: DirectoryConnectionValue, expectedVersion: number): Promise<DirectoryConnection>;
  runs(context: ReadTransactionContext, connection: string, after: string | null, fetch: number): Promise<readonly Readonly<Record<string, unknown>>[]>;
  createRun(context: WriteTransactionContext, connection: string, mode: SyncMode, key: string, preview?: boolean): Promise<SyncRun>;
  resumeRun(context: WriteTransactionContext, connection: string, run: string, key: string): Promise<SyncRun | null>;
  cancelRun(context: WriteTransactionContext, connection: string, run: string): Promise<Readonly<Record<string, unknown>> | null>;
  receive(context: WriteTransactionContext, input: Readonly<{ connection: string; eventid: string; version: number; bodyhash: string; payload: string }>): Promise<'accepted' | 'duplicate' | 'stale'>;
  lockMallParent(context: WriteTransactionContext, parent: string, accessScope: string): Promise<MallParentSnapshot>;
  mall(context: ReadTransactionContext, mall: string, accessScope: string): Promise<Mall>;
  lockMall(context: WriteTransactionContext, mall: string, accessScope: string): Promise<Mall>;
  membershipWithin(context: ReadTransactionContext, membership: string, organization: string): Promise<boolean>;
  createMall(context: WriteTransactionContext, input: Readonly<{ parent: Organization; mall: Mall; owner: Membership; expectedParentVersion: number }>): Promise<Mall>;
  updateMall(context: WriteTransactionContext, input: Readonly<{ current: Mall; mall: Mall; owner: Membership | null; expectedVersion: number }>): Promise<Mall>;
}
