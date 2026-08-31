import { errorDefinition } from '@shop/contract';
import { ApplicationError } from '../domain/ApplicationError';
import { OperationRejection } from '../application/ModuleOperations';
import { json, type HttpResponse } from './HttpResponse';

export class ErrorMapper {
  map(cause: unknown, requestId: string): HttpResponse {
    if (cause instanceof ApplicationError) return mapped(cause.code, requestId, cause.details);
    if (cause instanceof OperationRejection) return mapped(cause.code, requestId, cause.details);
    return internal(requestId);
  }
}

function mapped(code: string, requestId: string, details?: Readonly<Record<string, import('../domain/ApplicationError').ErrorDetail>>): HttpResponse {
  const definition = errorDefinition(code);
  if (definition === undefined || definition.status === 500) return internal(requestId);
  const publicDetails = validationDetails(code, details);
  return json(definition.status, { code, message: code, requestId, retryable: definition.retryable, ...(publicDetails === undefined ? {} : { details: publicDetails }) });
}

function internal(requestId: string): HttpResponse {
  return json(500, { code: 'INTERNAL_ERROR', message: 'INTERNAL_ERROR', requestId, retryable: true });
}

function validationDetails(code: string, details: Readonly<Record<string, import('../domain/ApplicationError').ErrorDetail>> | undefined) {
  const field = details?.field;
  return code === 'VALIDATION_FAILED' && typeof field === 'string' && /^[A-Za-z][A-Za-z0-9.]{0,127}$/.test(field) ? Object.freeze({ field }) : undefined;
}
