import { createHash } from 'node:crypto';
import { IMPORT_CAPACITY } from '@shop/config/runtime';
import { csvCell, parseCsvStream } from '../../../../foundation/application/Csv';
import type { ImportFailure } from '../../public/ImportProcess';
import type { ObjectStore, StoredObject } from '../../public/ObjectPort';
import { parseSpreadsheet } from './Spreadsheet';

export async function* readImportFile(objects: ObjectStore, reference: string, sha256: string, maximumBytes: number, maximumRows: number): AsyncIterable<Readonly<Record<string, string>>> {
  const metadata = await objects.inspect(reference);
  if (metadata.scan !== 'clean' || !SUPPORTED.has(metadata.contentType) || metadata.sha256 !== sha256 || metadata.size > maximumBytes) {
    throw new Error('IMPORT_OBJECT_INVALID');
  }
  if (metadata.contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    if (metadata.size > IMPORT_CAPACITY.maximumSpreadsheetBytes) throw new Error('IMPORT_OBJECT_INVALID');
    const bytes = await objects.read(reference, IMPORT_CAPACITY.maximumSpreadsheetBytes);
    if (bytes.byteLength !== metadata.size || createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error('IMPORT_HASH_MISMATCH');
    for await (const row of parseSpreadsheet(bytes, maximumRows)) yield row;
    return;
  }
  const hash = createHash('sha256');
  let size = 0;
  const verified = (async function* (): AsyncIterable<Uint8Array> {
    for await (const bytes of objects.chunks(reference, maximumBytes)) {
      size += bytes.byteLength;
      hash.update(bytes);
      yield bytes;
    }
    if (size !== metadata.size || hash.digest('hex') !== sha256) throw new Error('IMPORT_HASH_MISMATCH');
  })();
  for await (const row of parseCsvStream(verified, maximumRows)) yield row;
}

const SUPPORTED = new Set(['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);

export async function saveImportReport(objects: ObjectStore, owner: 'catalog' | 'finance' | 'inventory' | 'member' | 'order' | 'voucher', id: string, failures: readonly ImportFailure[]): Promise<StoredObject> {
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

function reportBytes(failures: readonly ImportFailure[]): Uint8Array {
  const rows = ['row,reason,field,detail', ...failures.map((failure) => [failure.row, failure.reason, failure.field ?? '', failure.detail].map(csvCell).join(','))];
  return new TextEncoder().encode(`\uFEFF${rows.join('\r\n')}\r\n`);
}
