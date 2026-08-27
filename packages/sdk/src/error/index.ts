import type { ContractJsonValue } from '@shop/contract';
import { ErrorContractSchema } from '@shop/contract/error';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly requestId: string,
    readonly retryable = false,
    readonly details?: Readonly<Record<string, ContractJsonValue>>,
    message = code,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ApiError';
  }

  static from(status: number, body: string, fallbackRequestId: string): ApiError {
    try {
      const decoded: unknown = JSON.parse(body);
      const result = ErrorContractSchema.safeParse(decoded);
      if (result.success) {
        const value = result.data;
        return new ApiError(value.code, status, value.requestId, value.retryable ?? false, value.details, value.message);
      }
    } catch (cause) {
      return new ApiError('CONTRACT_RESPONSE_INVALID', status, fallbackRequestId, false, undefined, 'The server returned an invalid error response.', { cause });
    }
    return new ApiError('CONTRACT_RESPONSE_INVALID', status, fallbackRequestId, false, undefined, 'The server returned an invalid error response.');
  }

  static contractResponse(requestId: string, cause: unknown): ApiError {
    return new ApiError('CONTRACT_RESPONSE_INVALID', 502, requestId, false, undefined, 'The server response did not match its Operation schema.', { cause });
  }
}
