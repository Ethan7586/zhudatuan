import { boolean, enum as enumeration, int, minLength, nonnegative, number, optional, strictObject, string } from 'zod/mini';
import type { Schema } from './schema';
import { API_ERROR_CODES, type ApiErrorCode } from './ErrorContract';

export interface ErrorContract {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly requestId: string;
  readonly retryable: boolean;
  readonly retryAfter?: number | undefined;
  readonly details?: Readonly<{ field: string }> | undefined;
}

export const ErrorContractSchema: Schema<ErrorContract> = strictObject({
  code: enumeration(API_ERROR_CODES),
  message: string().check(minLength(1)),
  requestId: string().check(minLength(1)),
  retryable: boolean(),
  retryAfter: optional(number().check(int(), nonnegative())),
  details: optional(strictObject({ field: string().check(minLength(1)) })),
});
