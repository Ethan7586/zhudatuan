import type { ClientErrorCode } from '@shop/contract';

export class ClientError<TCode extends ClientErrorCode = ClientErrorCode> extends Error {
  readonly kind = 'client' as const;
  readonly retryable = false;

  constructor(readonly code: TCode, readonly requestId?: string, options?: ErrorOptions) {
    super(code, options);
    this.name = 'ClientError';
  }
}
