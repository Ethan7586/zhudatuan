// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const CHECKOUT_OPERATION_IDS = Object.freeze([
  "checkout.quote.create",
  "checkout.quotes.current.read",
] as const satisfies readonly OperationId[]);

export interface CheckoutOperations {
  readonly quoteCreate: OperationMethod<"checkout.quote.create">;
  readonly quotesCurrentRead: OperationMethod<"checkout.quotes.current.read">;
}

export function createFetchCheckout(baseUrl: string): CheckoutOperations { return createCheckoutOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createCheckoutOperations(client: OperationExecutor): CheckoutOperations { return Object.freeze({
    quoteCreate: bindQuoteCreate(client),
    quotesCurrentRead: bindQuotesCurrentRead(client),
  }); }

export function createFetchCheckoutQuoteCreate(baseUrl: string): OperationMethod<"checkout.quote.create"> { return bindQuoteCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindQuoteCreate(client: OperationExecutor): OperationMethod<"checkout.quote.create"> { return bindOperation(client, defineOperation({"id":"checkout.quote.create","method":"POST","path":"/api/v1/checkouts/quotes","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":false,"timeout":1500})); }

export function createFetchCheckoutQuotesCurrentRead(baseUrl: string): OperationMethod<"checkout.quotes.current.read"> { return bindQuotesCurrentRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindQuotesCurrentRead(client: OperationExecutor): OperationMethod<"checkout.quotes.current.read"> { return bindOperation(client, defineOperation({"id":"checkout.quotes.current.read","method":"GET","path":"/api/v1/checkouts/quotes/current","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":800})); }
