// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInputFrom, exactOperationOutputFrom } from '@shop/contract/operationschema';
import { CHECKOUT_BODY_SCHEMAS, CHECKOUT_QUERY_SCHEMAS, CHECKOUT_OUTPUT_SCHEMAS } from '@shop/contract/schema/Checkout';
import { defineOperation } from '../CatalogOperationDescriptor';

export const CHECKOUT_OPERATION_IDS = Object.freeze([
  "checkout.quote.create",
  "checkout.quotes.current.read",
] as const satisfies readonly OperationId[]);

export interface CheckoutOperations {
  readonly quoteCreate: OperationMethod<"checkout.quote.create">;
  readonly quotesCurrentRead: OperationMethod<"checkout.quotes.current.read">;
}

export const CHECKOUT_METHOD_BY_OPERATION = Object.freeze({
  "checkout.quote.create": "quoteCreate",
  "checkout.quotes.current.read": "quotesCurrentRead",
} as const satisfies Readonly<Record<(typeof CHECKOUT_OPERATION_IDS)[number], keyof CheckoutOperations>>);

export function createFetchCheckout(baseUrl: string): CheckoutOperations { return createCheckoutOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createCheckoutOperations(client: OperationExecutor): CheckoutOperations { return Object.freeze({
    quoteCreate: bindQuoteCreate(client),
    quotesCurrentRead: bindQuotesCurrentRead(client),
  }); }

export function createFetchCheckoutQuoteCreate(baseUrl: string): OperationMethod<"checkout.quote.create"> { return bindQuoteCreate(new ApiClient(baseUrl, new FetchTransport())); }

export function bindQuoteCreate(client: OperationExecutor): OperationMethod<"checkout.quote.create"> { return bindOperation(client, defineOperation({ ...{"id":"checkout.quote.create","method":"POST","path":"/api/v1/checkouts/quotes","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":1500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","BENEFIT_BALANCE_INSUFFICIENT","CAPABILITY_DENIED","CART_EMPTY","CHECKOUT_BENEFIT_TIMEOUT","CHECKOUT_CART_TIMEOUT","CHECKOUT_CATALOG_TIMEOUT","CHECKOUT_EXPERIENCE_TIMEOUT","CHECKOUT_FINANCE_TIMEOUT","CHECKOUT_INVENTORY_TIMEOUT","CHECKOUT_MARKETING_TIMEOUT","CHECKOUT_MEMBER_TIMEOUT","CHECKOUT_ORDER_TIMEOUT","CHECKOUT_PRICING_TIMEOUT","CHECKOUT_QUALIFICATION_TIMEOUT","CHECKOUT_RISK_TIMEOUT","CHECKOUT_VOUCHER_TIMEOUT","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","INVENTORY_INSUFFICIENT","ORIGIN_REQUIRED","PERMISSION_DENIED","PRICE_QUOTE_EXPIRED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","RESOURCE_NOT_FOUND","RISK_DENIED","RISK_REVIEW_REQUIRED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT","VOUCHER_NOT_USABLE"]}, input: exactOperationInputFrom(CHECKOUT_BODY_SCHEMAS.CheckoutQuoteCreateInput, [] as const, true), output: exactOperationOutputFrom(CHECKOUT_OUTPUT_SCHEMAS.CheckoutQuoteCreateOutput) })); }

export function createFetchCheckoutQuotesCurrentRead(baseUrl: string): OperationMethod<"checkout.quotes.current.read"> { return bindQuotesCurrentRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindQuotesCurrentRead(client: OperationExecutor): OperationMethod<"checkout.quotes.current.read"> { return bindOperation(client, defineOperation({ ...{"id":"checkout.quotes.current.read","method":"GET","path":"/api/v1/checkouts/quotes/current","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","BENEFIT_BALANCE_INSUFFICIENT","CAPABILITY_DENIED","CART_EMPTY","CHECKOUT_PRICING_TIMEOUT","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","INVENTORY_INSUFFICIENT","LISTING_NOT_PURCHASABLE","PERMISSION_DENIED","PRICE_QUOTE_EXPIRED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInputFrom(CHECKOUT_QUERY_SCHEMAS.CheckoutQuotesCurrentReadInput, [] as const, false), output: exactOperationOutputFrom(CHECKOUT_OUTPUT_SCHEMAS.CheckoutQuotesCurrentReadOutput) })); }
