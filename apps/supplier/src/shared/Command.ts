import { createIdempotencyKey, type RequestContext } from '@shop/sdk/context';

export function supplierCommand(context: RequestContext, expectedVersion?: number): RequestContext {
  return Object.freeze({ ...context, idempotencyKey: createIdempotencyKey(), ...(expectedVersion === undefined ? {} : { expectedVersion }) });
}

export function supplierMessageId(): string {
  return createIdempotencyKey();
}
