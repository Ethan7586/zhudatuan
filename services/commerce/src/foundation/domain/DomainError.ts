import type { ApiErrorCode } from '@shop/contract';
import { ApplicationError, type ErrorDetail } from './ApplicationError';

export class DomainError extends ApplicationError {
  constructor(code: ApiErrorCode, details: Readonly<Record<string, ErrorDetail>> = {}) {
    super(code, details);
    this.name = 'DomainError';
  }
}
