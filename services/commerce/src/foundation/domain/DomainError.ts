import type { ErrorCode } from '@shop/contract';
import { ApplicationError, type ErrorDetail } from './ApplicationError';

export class DomainError extends ApplicationError {
  constructor(code: ErrorCode, details: Readonly<Record<string, ErrorDetail>> = {}) {
    super(code, details);
    this.name = 'DomainError';
  }
}
