import { createHash } from 'node:crypto';
import { parseCsv } from './Csv';
import type { ObjectStore, StoredObject } from './ObjectStore';
import { ApplicationError } from '../domain/ApplicationError';
import type { ImportFailure } from '../application/BatchImport';

export async function readImportFile(objects: ObjectStore, reference: string, sha256: string, maximumBytes = 32 * 1024 * 1024, maximumRows = 100_000): Promise<readonly Readonly<Record<string, string>>[]> {
  const metadata = await objects.inspect(reference);
  if (metadata.scan !== 'clean' || metadata.contentType !== 'text/csv' || metadata.sha256 !== sha256 || metadata.size > maximumBytes) {
    throw new Error('IMPORT_OBJECT_INVALID');
  }
  const bytes = await objects.read(reference, maximumBytes);
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error('IMPORT_HASH_MISMATCH');
  return parseCsv(bytes, maximumRows);
}

export async function saveImportReport(objects: ObjectStore, owner: 'catalog' | 'inventory' | 'member' | 'voucher', id: string, failures: readonly ImportFailure[]): Promise<StoredObject> {
  const bytes = reportBytes(failures);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const identity = createHash('sha256').update(id).digest('hex').slice(0, 32);
  const path = `${owner}/imports/${identity}/${sha256}.csv`;
  const existing = await objects.find(path);
  if (existing) {
    if (existing.contentType !== 'text/csv' || existing.sha256 !== sha256 || existing.size !== bytes.byteLength || existing.scan !== 'clean') {
      throw new Error('IMPORT_REPORT_COLLISION');
    }
    return existing;
  }
  const upload = await objects.create(path, 'text/csv');
  try {
    for (let offset = 0; offset < bytes.byteLength; offset += 4 * 1024 * 1024) {
      await upload.append(bytes.slice(offset, Math.min(bytes.byteLength, offset + 4 * 1024 * 1024)));
    }
    return await upload.complete();
  } catch (cause) {
    await upload.abort().catch(() => undefined);
    throw cause;
  }
}

export function importCode(cause: unknown, fallback: string): string {
  if (cause instanceof ApplicationError) return cause.code;
  if (cause instanceof Error && /^[A-Z][A-Z0-9_:.-]{0,99}$/.test(cause.message)) return cause.message;
  return fallback;
}

export function importDetail(cause: unknown): string {
  return cause instanceof ApplicationError || (cause instanceof Error && /^[A-Z][A-Z0-9_:.-]{0,99}$/.test(cause.message)) ? cause.message : 'row rejected';
}

function reportBytes(failures: readonly ImportFailure[]): Uint8Array {
  const rows = ['row,reason,field,detail', ...failures.map((failure) => [failure.row, failure.reason, failure.field ?? '', failure.detail].map(csv).join(','))];
  return new TextEncoder().encode(`\uFEFF${rows.join('\r\n')}\r\n`);
}

function csv(value: unknown): string {
  let text = String(value).replace(/[\r\n\t]/g, ' ');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
