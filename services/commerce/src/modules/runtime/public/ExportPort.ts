import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
export interface RuntimeExportRecord { readonly id: string; readonly kind: string; readonly state: 'pendingapproval' | 'queued' | 'running' | 'completed' | 'failed' | 'expired'; readonly expiresAt: string; readonly downloadToken?: string; readonly fileName?: string; readonly createdAt: string; readonly updatedAt: string; }
export interface RuntimeExportWork {
  readonly id: string;
  readonly scope: string;
  readonly kind: string;
  readonly snapshot: Readonly<Record<string, unknown>>;
  readonly authorization: Readonly<Record<string, unknown>>;
}
export interface RuntimeExportDownload { readonly record: RuntimeExportRecord; readonly reference: string; }
export interface ExportPort {
  create(context: WriteTransactionContext, input: Readonly<{ scope: string; owner: string; kind: string; snapshot: Readonly<Record<string, unknown>>; authorization: Readonly<Record<string, unknown>>; idempotency: string; actor: string }>): Promise<RuntimeExportRecord>;
  read(context: ReadTransactionContext, id: string, scope: string, owner: string): Promise<RuntimeExportRecord | null>;
  work(context: ReadTransactionContext, id: string, scope: string, owner: string): Promise<RuntimeExportWork | null>;
  claim(context: WriteTransactionContext, id: string, scope: string, owner: string): Promise<RuntimeExportWork | null>;
  ready(context: WriteTransactionContext, id: string, scope: string, owner: string, result: Readonly<{ reference: string; sha256: string; rows: number; tokenHash: string; expiresAt: string }>): Promise<void>;
  fail(context: WriteTransactionContext, id: string, scope: string, owner: string, terminal: boolean): Promise<void>;
  take(context: WriteTransactionContext, id: string, scope: string, owner: string): Promise<RuntimeExportDownload | null>;
}
export const EXPORT_PORT = publicPort<ExportPort>('runtime', 'export');
