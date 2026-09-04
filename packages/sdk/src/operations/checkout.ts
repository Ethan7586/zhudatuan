// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

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

function bindQuoteCreate(client: OperationExecutor): OperationMethod<"checkout.quote.create"> { return bindOperation(client, defineOperation({ ...{"id":"checkout.quote.create","method":"POST","path":"/api/v1/checkouts/quotes","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":false,"timeout":1500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","BENEFIT_BALANCE_INSUFFICIENT","CAPABILITY_DENIED","CART_EMPTY","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","INVENTORY_INSUFFICIENT","ORIGIN_REQUIRED","PERMISSION_DENIED","PRICE_QUOTE_EXPIRED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("CheckoutQuoteCreateInput", [] as const, true), output: exactOperationOutput("CheckoutQuoteCreateOutput") })); }

export function createFetchCheckoutQuotesCurrentRead(baseUrl: string): OperationMethod<"checkout.quotes.current.read"> { return bindQuotesCurrentRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindQuotesCurrentRead(client: OperationExecutor): OperationMethod<"checkout.quotes.current.read"> { return bindOperation(client, defineOperation({ ...{"id":"checkout.quotes.current.read","method":"GET","path":"/api/v1/checkouts/quotes/current","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","BENEFIT_BALANCE_INSUFFICIENT","CAPABILITY_DENIED","CART_EMPTY","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","INVENTORY_INSUFFICIENT","LISTING_NOT_PURCHASABLE","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("CheckoutQuotesCurrentReadInput", [] as const, false), output: exactOperationOutput("CheckoutQuotesCurrentReadOutput") })); }
