import { DomainError } from '../domain/DomainError';
import type { ObjectStore } from '../infrastructure/ObjectStore';
import { bodyRecord, textField } from '../interface/Validation';
import { requireAccess } from './ModuleOperations';
import type { OperationRequest, OperationResult } from './OperationHandler';
import type { AccessContext } from '../security/AccessContext';

export interface ImportPreparation {
  readonly access: AccessContext;
  readonly reference: string;
  readonly sha256: string;
}

export async function prepareImport(request: OperationRequest, objects: ObjectStore): Promise<ImportPreparation> {
  const access = requireAccess(request);
  const body = bodyRecord(request);
  const reference = textField(body, 'objectRef', 2048);
  const sha256 = textField(body, 'sha256', 64);
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new DomainError('VALIDATION_FAILED', { field: 'sha256' });
  const object = await objects.inspect(reference);
  if (object.scan !== 'clean' || object.contentType !== 'text/csv' || object.sha256 !== sha256 || object.size > 32 * 1024 * 1024) {
    throw new Error('IMPORT_OBJECT_INVALID');
  }
  return { access, reference, sha256 };
}

export async function projectImport(result: OperationResult, objects: ObjectStore): Promise<OperationResult> {
  const source = result.body as Readonly<Record<string, unknown>>;
  const { report_object_ref: reference, report_sha256: sha256, report_size: size, ...body } = source;
  if (typeof reference !== 'string') return { ...result, body };
  const download = await objects.authorize(reference, 300);
  return { ...result, body: { ...body, report: { sha256, size, download } } };
}
