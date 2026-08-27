import { boolean, minLength, optional, record, strictObject, string } from 'zod/mini';
import { ContractJsonValueSchema, type ContractJsonValue, type Schema } from './schema';

export interface ErrorContract {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly retryable?: boolean | undefined;
  readonly details?: Readonly<Record<string, ContractJsonValue>> | undefined;
}

export const ErrorContractSchema: Schema<ErrorContract> = strictObject({
  code: string().check(minLength(1)),
  message: string().check(minLength(1)),
  requestId: string().check(minLength(1)),
  retryable: optional(boolean()),
  details: optional(record(string(), ContractJsonValueSchema)),
});
