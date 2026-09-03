import { errorStatus, type ApiErrorCode } from '@shop/contract';
import type { ErrorDetail } from '../domain/ApplicationError';
import type { OperationResult } from './OperationRequest';

export class OperationRejection extends Error {
  readonly result: OperationResult;

  constructor(
    readonly code: ApiErrorCode,
    readonly details?: Readonly<Record<string, ErrorDetail>>
  ) {
    super(code);
    this.name = 'OperationRejection';
    const status = errorStatus(code);
    if (status === undefined) throw new Error('ERROR_CONTRACT_MISSING');
    this.result = { status, body: { code, ...(details === undefined ? {} : { details }) } };
  }
}

export function reject(code: ApiErrorCode, details?: Readonly<Record<string, ErrorDetail>>): never {
  throw new OperationRejection(code, details);
}
