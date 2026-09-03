import type { ApiErrorCode, ClientErrorCode, OperationId, TransportErrorCode } from '@shop/contract';
import { errorDefinition } from '@shop/contract/errors';
import { ErrorContractSchema } from '@shop/contract/error';

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
        if (!allowed.includes(value.code) || definition?.status !== status) {
          return neverApiError(new TransportError('CONTRACT_INVALID', fallbackRequestId, false, undefined, { cause: value }, operation));
        }
        return new ApiError(value.code, status, value.requestId, value.retryable, value.details, value.message, undefined, value.retryAfter, operation);
      }
    } catch (cause) {
      return neverApiError(new TransportError('CONTRACT_INVALID', fallbackRequestId, false, undefined, { cause }, operation));
    }
    return neverApiError(new TransportError('CONTRACT_INVALID', fallbackRequestId, false, undefined, undefined, operation));
  }

  static contractResponse(requestId: string, cause: unknown, operation?: OperationId): TransportError {
    return new TransportError('CONTRACT_INVALID', requestId, false, undefined, { cause }, operation);
  }
}

export class TransportError<TCode extends TransportErrorCode = TransportErrorCode> extends Error {
  readonly kind = 'transport' as const;
  constructor(
    readonly code: TCode,
    readonly requestId: string | undefined,
    readonly retryable: boolean,
    readonly retryAfter?: number,
    options?: ErrorOptions,
    readonly operation?: OperationId
  ) {
    super(code, options);
    this.name = 'TransportError';
  }
}

export class ClientError<TCode extends ClientErrorCode = ClientErrorCode> extends Error {
  readonly kind = 'client' as const;
  readonly retryable = false;
  constructor(readonly code: TCode, readonly requestId?: string, options?: ErrorOptions) {
    super(code, options);
    this.name = 'ClientError';
  }
}

export function isCancelled(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === 'AbortError';
}

function neverApiError(error: TransportError): never {
  throw error;
}
