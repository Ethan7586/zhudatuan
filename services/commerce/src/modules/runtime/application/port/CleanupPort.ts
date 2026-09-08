import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface CleanupBatch {
  readonly ids: readonly string[];
  readonly objects: readonly string[];
}

export interface IdempotencyCleanupKey {
  readonly scope: string;
  readonly actor: string;
  readonly key: string;
}

export interface InboxCleanupKey {
  readonly consumer: string;
  readonly event: string;
}

export interface CleanupEvidence {
  readonly hash: string;
  readonly createdAt: string;
  readonly inboxBefore: string;
  readonly outboxBefore: string;
  readonly counts: Readonly<Record<string, number>>;
}

export interface JobCleanup {
  recover(context: WriteTransactionContext, currentJobId: string, limit: number): Promise<void>;
  plan(context: ReadTransactionContext, limit: number): Promise<readonly string[]>;
  record(context: WriteTransactionContext, job: Readonly<{ id: string; token: number }>, evidence: CleanupEvidence): Promise<void>;
  purge(context: WriteTransactionContext, ids: readonly string[]): Promise<number>;
}

export interface ImportCleanup {
  expire(context: WriteTransactionContext, limit: number): Promise<void>;
  plan(context: ReadTransactionContext, limit: number): Promise<CleanupBatch>;
  purge(context: WriteTransactionContext, ids: readonly string[]): Promise<number>;
}

export interface ExportCleanup {
  plan(context: ReadTransactionContext, limit: number): Promise<CleanupBatch>;
  purge(context: WriteTransactionContext, ids: readonly string[]): Promise<number>;
}

export interface RuntimeControlCleanup {
  planIdempotency(context: ReadTransactionContext, limit: number): Promise<readonly IdempotencyCleanupKey[]>;
  purgeIdempotency(context: WriteTransactionContext, keys: readonly IdempotencyCleanupKey[]): Promise<number>;
  planDeadletters(context: ReadTransactionContext, limit: number): Promise<readonly string[]>;
  purgeDeadletters(context: WriteTransactionContext, ids: readonly string[]): Promise<number>;
}

export interface InboxCleanup {
  plan(context: ReadTransactionContext, before: Date, limit: number): Promise<readonly InboxCleanupKey[]>;
  purge(context: WriteTransactionContext, keys: readonly InboxCleanupKey[], before: Date): Promise<number>;
}

export interface OutboxCleanup {
  plan(context: ReadTransactionContext, before: Date, limit: number): Promise<readonly string[]>;
  purge(context: WriteTransactionContext, ids: readonly string[], before: Date): Promise<number>;
}

export interface RuntimeCleanupPorts {
  readonly jobs: JobCleanup;
  readonly imports: ImportCleanup;
  readonly exports: ExportCleanup;
  readonly control: RuntimeControlCleanup;
  readonly inbox: InboxCleanup;
  readonly outbox: OutboxCleanup;
}
