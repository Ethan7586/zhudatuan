import { boolean, minLength, optional, strictObject, string } from 'zod/mini';
import type { Schema } from './schema';

export interface ErrorContract {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly retryable: boolean;
  readonly details?: Readonly<{ field: string }> | undefined;
}

export const ErrorContractSchema: Schema<ErrorContract> = strictObject({
  code: string().check(minLength(1)),
  message: string().check(minLength(1)),
  requestId: string().check(minLength(1)),
  retryable: boolean(),
  details: optional(strictObject({ field: string().check(minLength(1)) })),
});
