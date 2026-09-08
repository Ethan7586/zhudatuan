import { IMPORT_CAPACITY } from '@shop/config/runtime';
import { createHash } from 'node:crypto';
import { DomainError } from '../../../../platform/error/DomainError';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import type { ObjectStore } from '../../public/ObjectPort';
import type { ImportObjectPort, ImportObjectRequest, PreparedImportObject } from '../../public/ImportObjectPort';
import { assertObjectContent } from '../../domain/policy/ObjectContentPolicy';

export class PrepareImportObject implements ImportObjectPort {
  constructor(private readonly objects: ObjectStore) {}

  async prepare(input: ImportObjectRequest, tenant?: string): Promise<PreparedImportObject> {
    const body = bodyRecord(input);
    const reference = textField(body, 'objectRef', 2048);
    const sha256 = textField(body, 'sha256', 64);
    if (!/^[0-9a-f]{64}$/.test(sha256)) throw new DomainError('VALIDATION_FAILED', { field: 'sha256' });
    const object = await this.objects.inspect(reference);
    if (
      object.scan !== 'clean' ||
      !SUPPORTED.has(object.contentType) ||
      object.sha256 !== sha256 ||
      object.size > IMPORT_CAPACITY.maximumFileBytes ||
      (object.contentType.endsWith('spreadsheetml.sheet') && object.size > IMPORT_CAPACITY.maximumSpreadsheetBytes)
    )
      throw new Error('IMPORT_OBJECT_INVALID');
    if (tenant !== undefined) {
      const owner = createHash('sha256').update(tenant).digest('hex').slice(0, 32);
      if (!object.path.startsWith(`tenant/${owner}/import/`)) throw new Error('IMPORT_OBJECT_SCOPE_INVALID');
    }
    await verifyMagic(this.objects, object.reference, object.size, object.contentType);
    const name = fileName(body.fileName, object.contentType);
    return Object.freeze({ reference, sha256, name, mediaType: object.contentType, size: object.size });
  }
}

const SUPPORTED = new Set(['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);

function fileName(value: unknown, contentType: string): string {
  const fallback = contentType === 'text/csv' ? 'import.csv' : 'import.xlsx';
  if (value === undefined) return fallback;
  if (typeof value !== 'string') throw new DomainError('VALIDATION_FAILED', { field: 'fileName' });
  const name = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f/\\]/gu, '')
    .trim();
  const suffix = contentType === 'text/csv' ? '.csv' : '.xlsx';
  if (!name.toLowerCase().endsWith(suffix) || name.length < suffix.length + 1 || name.length > 255) {
    throw new DomainError('VALIDATION_FAILED', { field: 'fileName' });
  }
  return name;
}

async function verifyMagic(objects: Pick<ObjectStore, 'chunks'>, reference: string, size: number, contentType: string): Promise<void> {
  let sample = new Uint8Array();
  for await (const part of objects.chunks(reference, size)) {
    sample = part.slice(0, 16);
    break;
  }
  assertObjectContent(contentType, sample);
}
