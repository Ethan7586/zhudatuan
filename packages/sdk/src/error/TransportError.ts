import type { OperationId, TransportErrorCode } from '@shop/contract';

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
