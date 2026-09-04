import { errorStatus } from '@shop/contract';
import { DomainError } from '../domain/DomainError';
import { json, type HttpResponse } from './HttpResponse';

export class ErrorMapper {
  map(cause: unknown, requestId: string): HttpResponse {
    if (cause instanceof DomainError) return mapped(cause.code, requestId, cause.details);
    if (cause instanceof Error) {
      const code = cause.message.split(':', 1)[0]!;
      return mapped(code, requestId);
    }
    return internal(requestId);
  }
}

function mapped(code: string, requestId: string, details?: Readonly<Record<string, unknown>>): HttpResponse {
  const status = errorStatus(code);
  if (status === undefined || status === 500) return internal(requestId);
  return json(status, { code, message: code, requestId, ...(details === undefined ? {} : { details }) });
}

function internal(requestId: string): HttpResponse {
  return json(500, { code: 'INTERNAL_ERROR', message: 'INTERNAL_ERROR', requestId });
}
