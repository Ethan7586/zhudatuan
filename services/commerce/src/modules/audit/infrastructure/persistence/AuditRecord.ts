import { createHash } from 'node:crypto';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { AccessRecord } from '../../domain/model/AccessRecord';
import type { AuditRecord } from '../../domain/model/AuditRecord';
import type { ArchiveBatch, ArchiveDisposal, ArchiveObject, AuditRepository } from '../../application/port/AuditRepository';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';

export interface ArchiveRow {
  readonly id: string;
  readonly kind: 'command' | 'access';
  readonly occurred: string;
  readonly record_hash: string;
  readonly previous_hash: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
}

export function nextArchiveAt(immediate: boolean): Date {
  const next = new Date();
  next.setUTCSeconds(0, 0);
  if (immediate) next.setUTCMinutes(next.getUTCMinutes() + 1);
  else {
    next.setUTCMinutes(0);
    next.setUTCHours(next.getUTCHours() + 1);
  }
  return next;
}

export function minuteKey(value: Date): string {
  return value.toISOString().replace(/[-:T]/g, '').slice(0, 12);
}
