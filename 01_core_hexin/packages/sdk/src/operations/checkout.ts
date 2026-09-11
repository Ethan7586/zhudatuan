// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineContractOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const CHECKOUT_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "checkout.quote.create",
] as const satisfies readonly OperationId[]);

export interface CheckoutOperations {
  readonly quoteCreate: OperationMethod<"checkout.quote.create">;
}

export function createFetchCheckout(baseUrl: string): CheckoutOperations {
  return createCheckoutOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createCheckoutOperations(client: OperationExecutor): CheckoutOperations {
  return Object.freeze({
    quoteCreate: bindQuoteCreate(client),
  });
}

export function createFetchCheckoutQuoteCreate(baseUrl: string): OperationMethod<"checkout.quote.create"> {
  return bindQuoteCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindQuoteCreate(client: OperationExecutor): OperationMethod<"checkout.quote.create"> {
  return bindOperation(client, defineContractOperation({"id":"checkout.quote.create","method":"POST","path":"/api/v1/checkouts/quotes","audience":"member","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}
