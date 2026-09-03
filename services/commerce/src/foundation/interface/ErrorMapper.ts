import { OperationCatalog, type OperationId } from '@shop/contract';
import { errorDefinition } from '@shop/contract/errors';
import { ApplicationError } from '../domain/ApplicationError';
import { OperationRejection } from '../application/OperationRejection';
import { json, type HttpResponse } from './HttpResponse';

export class ErrorMapper {
  map(cause: unknown, requestId: string, operation?: OperationId): HttpResponse {
    if (operation === undefined) return internal(requestId);
    if (cause instanceof ApplicationError) return operationMapped(cause.code, requestId, operation, cause.details);
    if (cause instanceof OperationRejection) return operationMapped(cause.code, requestId, operation, cause.details);
    return internal(requestId);
  }
}

function operationMapped(code: string, requestId: string, operation: OperationId, details?: Readonly<Record<string, import('../domain/ApplicationError').ErrorDetail>>): HttpResponse {
  if (!OperationCatalog.get(operation).errorUnion.includes(code as never)) return internal(requestId);
  return catalogued(code, requestId, details);
}

function catalogued(code: string, requestId: string, details?: Readonly<Record<string, import('../domain/ApplicationError').ErrorDetail>>): HttpResponse {
  const definition = errorDefinition(code);
  if (definition === undefined) return internal(requestId);
  const publicDetails = allowedDetails(definition.details, details);
  const retryAfter = definition.retryAfter && typeof details?.retryAfter === 'number' && Number.isSafeInteger(details.retryAfter) && details.retryAfter >= 0 ? details.retryAfter : undefined;
  return json(
    definition.status,
    {
      code,
      message: definition.exposure === 'message' ? definition.message : 'REQUEST_FAILED',
      requestId,
      retryable: definition.retryable,
      ...(retryAfter === undefined ? {} : { retryAfter }),
      ...(publicDetails === undefined ? {} : { details: publicDetails }),
    },
    retryAfter === undefined ? {} : { 'retry-after': String(retryAfter) }
  );
}

function internal(requestId: string): HttpResponse {
  return json(500, { code: 'INTERNAL_ERROR', message: 'INTERNAL_ERROR', requestId, retryable: true });
}

function allowedDetails(allowed: readonly string[], details: Readonly<Record<string, import('../domain/ApplicationError').ErrorDetail>> | undefined) {
  if (!allowed.includes('field')) return undefined;
  const field = details?.field;
  return typeof field === 'string' && /^[A-Za-z][A-Za-z0-9.]{0,127}$/.test(field) ? Object.freeze({ field }) : undefined;
}
