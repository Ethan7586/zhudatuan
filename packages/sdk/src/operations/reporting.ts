// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineStructuralOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const REPORTING_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "reporting.dashboard.read",
  "reporting.sales.read",
  "reporting.products.read",
  "reporting.malls.read",
  "reporting.categories.read",
  "reporting.channels.read",
  "reporting.powderclass.read",
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
  readonly powderclassRead: OperationMethod<"reporting.powderclass.read">;
  readonly voucherconsumptionRead: OperationMethod<"reporting.voucherconsumption.read">;
  readonly exportsCreate: OperationMethod<"reporting.exports.create">;
  readonly exportsRead: OperationMethod<"reporting.exports.read">;
}

export function createFetchReporting(baseUrl: string): ReportingOperations {
  return createReportingOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createReportingOperations(client: OperationExecutor): ReportingOperations {
  return Object.freeze({
    dashboardRead: bindDashboardRead(client),
    salesRead: bindSalesRead(client),
    productsRead: bindProductsRead(client),
    mallsRead: bindMallsRead(client),
    categoriesRead: bindCategoriesRead(client),
    channelsRead: bindChannelsRead(client),
    powderclassRead: bindPowderclassRead(client),
    voucherconsumptionRead: bindVoucherconsumptionRead(client),
    exportsCreate: bindExportsCreate(client),
    exportsRead: bindExportsRead(client),
  });
}

export function createFetchReportingDashboardRead(baseUrl: string): OperationMethod<"reporting.dashboard.read"> {
  return bindDashboardRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindDashboardRead(client: OperationExecutor): OperationMethod<"reporting.dashboard.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"reporting.dashboard.read","method":"GET","path":"/api/v1/reports/dashboard","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchReportingSalesRead(baseUrl: string): OperationMethod<"reporting.sales.read"> {
  return bindSalesRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindSalesRead(client: OperationExecutor): OperationMethod<"reporting.sales.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"reporting.sales.read","method":"GET","path":"/api/v1/reports/sales","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchReportingProductsRead(baseUrl: string): OperationMethod<"reporting.products.read"> {
  return bindProductsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindProductsRead(client: OperationExecutor): OperationMethod<"reporting.products.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"reporting.products.read","method":"GET","path":"/api/v1/reports/products","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchReportingMallsRead(baseUrl: string): OperationMethod<"reporting.malls.read"> {
  return bindMallsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindMallsRead(client: OperationExecutor): OperationMethod<"reporting.malls.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"reporting.malls.read","method":"GET","path":"/api/v1/reports/malls","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchReportingCategoriesRead(baseUrl: string): OperationMethod<"reporting.categories.read"> {
  return bindCategoriesRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCategoriesRead(client: OperationExecutor): OperationMethod<"reporting.categories.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"reporting.categories.read","method":"GET","path":"/api/v1/reports/categories","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchReportingChannelsRead(baseUrl: string): OperationMethod<"reporting.channels.read"> {
  return bindChannelsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindChannelsRead(client: OperationExecutor): OperationMethod<"reporting.channels.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"reporting.channels.read","method":"GET","path":"/api/v1/reports/channels","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchReportingPowderclassRead(baseUrl: string): OperationMethod<"reporting.powderclass.read"> {
  return bindPowderclassRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindPowderclassRead(client: OperationExecutor): OperationMethod<"reporting.powderclass.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"reporting.powderclass.read","method":"GET","path":"/api/v1/reports/powderclass","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchReportingVoucherconsumptionRead(baseUrl: string): OperationMethod<"reporting.voucherconsumption.read"> {
  return bindVoucherconsumptionRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindVoucherconsumptionRead(client: OperationExecutor): OperationMethod<"reporting.voucherconsumption.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"reporting.voucherconsumption.read","method":"GET","path":"/api/v1/reports/voucherconsumption","audience":"operator","idempotent":true,"pathKeys":[]}));
}

export function createFetchReportingExportsCreate(baseUrl: string): OperationMethod<"reporting.exports.create"> {
  return bindExportsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindExportsCreate(client: OperationExecutor): OperationMethod<"reporting.exports.create"> {
  return bindOperation(client, defineStructuralOperation({"id":"reporting.exports.create","method":"POST","path":"/api/v1/reports/exports","audience":"operator","idempotent":false,"pathKeys":[]}));
}

export function createFetchReportingExportsRead(baseUrl: string): OperationMethod<"reporting.exports.read"> {
  return bindExportsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindExportsRead(client: OperationExecutor): OperationMethod<"reporting.exports.read"> {
  return bindOperation(client, defineStructuralOperation({"id":"reporting.exports.read","method":"GET","path":"/api/v1/reports/exports/{exportid}","audience":"operator","idempotent":true,"pathKeys":["exportid"]}));
}
