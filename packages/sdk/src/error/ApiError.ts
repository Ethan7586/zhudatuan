import type { ApiErrorCode, OperationId } from '@shop/contract';
import { ErrorContractSchema } from '@shop/contract/error';
import { errorDefinition } from '@shop/contract/errors';
import { TransportError } from './TransportError';

export class ApiError<TCode extends ApiErrorCode = ApiErrorCode> extends Error {
  readonly kind = 'api' as const;

  constructor(
    readonly code: TCode,
    readonly status: number,
    readonly requestId: string,
    readonly retryable = false,
    readonly details?: Readonly<{ field: string }>,
    message: string = code,
    options?: ErrorOptions,
    readonly retryAfter?: number,
    readonly operation?: OperationId
  ) {
    super(message, options);
    this.name = 'ApiError';
  }

  static from(status: number, body: string, fallbackRequestId: string, operation: OperationId, allowed: readonly ApiErrorCode[]): ApiError {
    try {
      const decoded: unknown = JSON.parse(body);
      const result = ErrorContractSchema.safeParse(decoded);
      if (result.success) {
        const value = result.data;
        const definition = errorDefinition(value.code);
        if (!allowed.includes(value.code) || definition?.status !== status) throw new TransportError('CONTRACT_INVALID', fallbackRequestId, false, undefined, { cause: value }, operation);
        return new ApiError(value.code, status, value.requestId, value.retryable, value.details, value.message, undefined, value.retryAfter, operation);
      }
    } catch (cause) {
      if (cause instanceof TransportError) throw cause;
      throw new TransportError('CONTRACT_INVALID', fallbackRequestId, false, undefined, { cause }, operation);
    }
    throw new TransportError('CONTRACT_INVALID', fallbackRequestId, false, undefined, undefined, operation);
  }

  static contractResponse(requestId: string, cause: unknown, operation?: OperationId): TransportError {
    return new TransportError('CONTRACT_INVALID', requestId, false, undefined, { cause }, operation);
  }
}
