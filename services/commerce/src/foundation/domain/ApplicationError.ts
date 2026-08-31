import type { ErrorCode } from '@shop/contract';

export type ErrorDetail = string | number | boolean | null | readonly ErrorDetail[] | Readonly<{ [key: string]: ErrorDetail }>;

export class ApplicationError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly details: Readonly<Record<string, ErrorDetail>> = {},
    override readonly cause?: unknown
  ) {
    super(code, { cause });
    this.name = 'ApplicationError';
  }
}
