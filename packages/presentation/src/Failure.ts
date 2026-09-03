import type { ApiErrorCode, ClientErrorCode, TransportErrorCode } from '@shop/contract';
import { errorPolicy } from './generated/ErrorPolicy';

interface FailureBase {
  readonly requestId?: string;
  readonly retryable: boolean;
  readonly retryAfter?: number;
}

export interface ApiFailure extends FailureBase {
  readonly kind: 'api';
  readonly code: ApiErrorCode;
}

export interface TransportFailure extends FailureBase {
  readonly kind: 'transport';
  readonly code: TransportErrorCode;
}

export interface ClientFailure extends FailureBase {
  readonly kind: 'client';
  readonly code: ClientErrorCode;
}

export type Failure = ApiFailure | TransportFailure | ClientFailure;

export function failure(cause: unknown): Failure {
  if (isFailure(cause)) return cause;
  return Object.freeze({ kind: 'client', code: 'UNEXPECTED_FAILURE', retryable: false });
}

function isFailure(value: unknown): value is Failure {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Failure>;
  if ((candidate.kind !== 'api' && candidate.kind !== 'transport' && candidate.kind !== 'client') || typeof candidate.code !== 'string' || typeof candidate.retryable !== 'boolean') return false;
  return errorPolicy(candidate.code)?.kind === candidate.kind;
}

export function hasFailureCode(cause: unknown, code: ApiErrorCode | TransportErrorCode | ClientErrorCode): boolean {
  return failure(cause).code === code;
}

export function isTerminalFailure(cause: unknown): boolean {
  const value = failure(cause);
  return value.kind === 'client' || (value.kind === 'transport' && value.code === 'CONTRACT_INVALID');
}
