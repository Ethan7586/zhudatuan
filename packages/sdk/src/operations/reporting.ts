// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const REPORTING_OPERATION_IDS = Object.freeze([
  "reporting.dashboard.read",
  "reporting.sales.read",
  "reporting.products.read",
  "reporting.malls.read",
  "reporting.categories.read",
  "reporting.channels.read",
  "reporting.voucherconsumption.read",
  "reporting.exports.create",
  "reporting.exports.read",
] as const satisfies readonly OperationId[]);

export interface ReportingOperations {
  readonly dashboardRead: OperationMethod<"reporting.dashboard.read">;
  readonly salesRead: OperationMethod<"reporting.sales.read">;
  readonly productsRead: OperationMethod<"reporting.products.read">;
  readonly mallsRead: OperationMethod<"reporting.malls.read">;
  readonly categoriesRead: OperationMethod<"reporting.categories.read">;
  readonly channelsRead: OperationMethod<"reporting.channels.read">;
  readonly voucherconsumptionRead: OperationMethod<"reporting.voucherconsumption.read">;
  readonly exportsCreate: OperationMethod<"reporting.exports.create">;
  readonly exportsRead: OperationMethod<"reporting.exports.read">;
}

export const REPORTING_METHOD_BY_OPERATION = Object.freeze({
  "reporting.dashboard.read": "dashboardRead",
  "reporting.sales.read": "salesRead",
  "reporting.products.read": "productsRead",
  "reporting.malls.read": "mallsRead",
  "reporting.categories.read": "categoriesRead",
  "reporting.channels.read": "channelsRead",
  "reporting.voucherconsumption.read": "voucherconsumptionRead",
  "reporting.exports.create": "exportsCreate",
  "reporting.exports.read": "exportsRead",
} as const satisfies Readonly<Record<(typeof REPORTING_OPERATION_IDS)[number], keyof ReportingOperations>>);

export function createFetchReporting(baseUrl: string): ReportingOperations { return createReportingOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createReportingOperations(client: OperationExecutor): ReportingOperations { return Object.freeze({
    dashboardRead: bindDashboardRead(client),
    salesRead: bindSalesRead(client),
    productsRead: bindProductsRead(client),
    mallsRead: bindMallsRead(client),
    categoriesRead: bindCategoriesRead(client),
    channelsRead: bindChannelsRead(client),
    voucherconsumptionRead: bindVoucherconsumptionRead(client),
    exportsCreate: bindExportsCreate(client),
    exportsRead: bindExportsRead(client),
  }); }

export function createFetchReportingDashboardRead(baseUrl: string): OperationMethod<"reporting.dashboard.read"> { return bindDashboardRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindDashboardRead(client: OperationExecutor): OperationMethod<"reporting.dashboard.read"> { return bindOperation(client, defineOperation({ ...{"id":"reporting.dashboard.read","method":"GET","path":"/api/v1/reports/dashboard","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ReportingDashboardReadInput", [] as const, false), output: exactOperationOutput("ReportingDashboardReadOutput") })); }

export function createFetchReportingSalesRead(baseUrl: string): OperationMethod<"reporting.sales.read"> { return bindSalesRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindSalesRead(client: OperationExecutor): OperationMethod<"reporting.sales.read"> { return bindOperation(client, defineOperation({ ...{"id":"reporting.sales.read","method":"GET","path":"/api/v1/reports/sales","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ReportingSalesReadInput", [] as const, false), output: exactOperationOutput("ReportingSalesReadOutput") })); }

export function createFetchReportingProductsRead(baseUrl: string): OperationMethod<"reporting.products.read"> { return bindProductsRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindProductsRead(client: OperationExecutor): OperationMethod<"reporting.products.read"> { return bindOperation(client, defineOperation({ ...{"id":"reporting.products.read","method":"GET","path":"/api/v1/reports/products","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ReportingProductsReadInput", [] as const, false), output: exactOperationOutput("ReportingProductsReadOutput") })); }

export function createFetchReportingMallsRead(baseUrl: string): OperationMethod<"reporting.malls.read"> { return bindMallsRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindMallsRead(client: OperationExecutor): OperationMethod<"reporting.malls.read"> { return bindOperation(client, defineOperation({ ...{"id":"reporting.malls.read","method":"GET","path":"/api/v1/reports/malls","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ReportingMallsReadInput", [] as const, false), output: exactOperationOutput("ReportingMallsReadOutput") })); }

export function createFetchReportingCategoriesRead(baseUrl: string): OperationMethod<"reporting.categories.read"> { return bindCategoriesRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindCategoriesRead(client: OperationExecutor): OperationMethod<"reporting.categories.read"> { return bindOperation(client, defineOperation({ ...{"id":"reporting.categories.read","method":"GET","path":"/api/v1/reports/categories","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ReportingCategoriesReadInput", [] as const, false), output: exactOperationOutput("ReportingCategoriesReadOutput") })); }

export function createFetchReportingChannelsRead(baseUrl: string): OperationMethod<"reporting.channels.read"> { return bindChannelsRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindChannelsRead(client: OperationExecutor): OperationMethod<"reporting.channels.read"> { return bindOperation(client, defineOperation({ ...{"id":"reporting.channels.read","method":"GET","path":"/api/v1/reports/channels","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ReportingChannelsReadInput", [] as const, false), output: exactOperationOutput("ReportingChannelsReadOutput") })); }

export function createFetchReportingVoucherconsumptionRead(baseUrl: string): OperationMethod<"reporting.voucherconsumption.read"> { return bindVoucherconsumptionRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindVoucherconsumptionRead(client: OperationExecutor): OperationMethod<"reporting.voucherconsumption.read"> { return bindOperation(client, defineOperation({ ...{"id":"reporting.voucherconsumption.read","method":"GET","path":"/api/v1/reports/voucherconsumption","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ReportingVoucherconsumptionReadInput", [] as const, false), output: exactOperationOutput("ReportingVoucherconsumptionReadOutput") })); }

export function createFetchReportingExportsCreate(baseUrl: string): OperationMethod<"reporting.exports.create"> { return bindExportsCreate(new ApiClient(baseUrl, new FetchTransport())); }

export function bindExportsCreate(client: OperationExecutor): OperationMethod<"reporting.exports.create"> { return bindOperation(client, defineOperation({ ...{"id":"reporting.exports.create","method":"POST","path":"/api/v1/reports/exports","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ReportingExportsCreateInput", [] as const, true), output: exactOperationOutput("ReportingExportsCreateOutput") })); }

export function createFetchReportingExportsRead(baseUrl: string): OperationMethod<"reporting.exports.read"> { return bindExportsRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindExportsRead(client: OperationExecutor): OperationMethod<"reporting.exports.read"> { return bindOperation(client, defineOperation({ ...{"id":"reporting.exports.read","method":"GET","path":"/api/v1/reports/exports/{exportid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("ReportingExportsReadInput", ["exportid"] as const, false), output: exactOperationOutput("ReportingExportsReadOutput") })); }
