// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindEventOperation, bindOperation, defineOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const VOUCHER_OPERATION_IDS = Object.freeze([
  "voucher.cardlibraries.read",
  "voucher.cardlibraries.create",
  "voucher.cardlibraries.allocate",
  "voucher.imports.read",
  "voucher.programs.read",
  "voucher.programs.manage",
  "voucher.reserves.read",
  "voucher.reserves.request",
  "voucher.reserves.decide",
  "voucher.batches.read",
  "voucher.batches.issue",
  "voucher.batches.retry",
  "voucher.status.batch",
  "voucher.statusbatches.read",
  "voucher.bindings.read",
  "voucher.bindings.manage",
  "voucher.redemptions.read",
  "voucher.history.read",
  "voucher.redemptions.reverse",
] as const satisfies readonly OperationId[]);

export interface VoucherOperations {
  readonly cardlibrariesRead: OperationMethod<"voucher.cardlibraries.read">;
  readonly cardlibrariesCreate: OperationMethod<"voucher.cardlibraries.create">;
  readonly cardlibrariesAllocate: OperationMethod<"voucher.cardlibraries.allocate">;
  readonly importsRead: OperationMethod<"voucher.imports.read">;
  readonly programsRead: OperationMethod<"voucher.programs.read">;
  readonly programsManage: OperationMethod<"voucher.programs.manage">;
  readonly reservesRead: OperationMethod<"voucher.reserves.read">;
  readonly reservesRequest: OperationMethod<"voucher.reserves.request">;
  readonly reservesDecide: OperationMethod<"voucher.reserves.decide">;
  readonly batchesRead: OperationMethod<"voucher.batches.read">;
  readonly batchesIssue: OperationMethod<"voucher.batches.issue">;
  readonly batchesRetry: OperationMethod<"voucher.batches.retry">;
  readonly statusBatch: OperationMethod<"voucher.status.batch">;
  readonly statusbatchesRead: OperationMethod<"voucher.statusbatches.read">;
  readonly bindingsRead: OperationMethod<"voucher.bindings.read">;
  readonly bindingsManage: OperationMethod<"voucher.bindings.manage">;
  readonly redemptionsRead: OperationMethod<"voucher.redemptions.read">;
  readonly historyRead: OperationMethod<"voucher.history.read">;
  readonly redemptionsReverse: OperationMethod<"voucher.redemptions.reverse">;
}

export function createFetchVoucher(baseUrl: string): VoucherOperations { return createVoucherOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createVoucherOperations(client: OperationExecutor): VoucherOperations { return Object.freeze({
    cardlibrariesRead: bindCardlibrariesRead(client),
    cardlibrariesCreate: bindCardlibrariesCreate(client),
    cardlibrariesAllocate: bindCardlibrariesAllocate(client),
    importsRead: bindImportsRead(client),
    programsRead: bindProgramsRead(client),
    programsManage: bindProgramsManage(client),
    reservesRead: bindReservesRead(client),
    reservesRequest: bindReservesRequest(client),
    reservesDecide: bindReservesDecide(client),
    batchesRead: bindBatchesRead(client),
    batchesIssue: bindBatchesIssue(client),
    batchesRetry: bindBatchesRetry(client),
    statusBatch: bindStatusBatch(client),
    statusbatchesRead: bindStatusbatchesRead(client),
    bindingsRead: bindBindingsRead(client),
    bindingsManage: bindBindingsManage(client),
    redemptionsRead: bindRedemptionsRead(client),
    historyRead: bindHistoryRead(client),
    redemptionsReverse: bindRedemptionsReverse(client),
  }); }

export function createFetchVoucherCardlibrariesRead(baseUrl: string): OperationMethod<"voucher.cardlibraries.read"> { return bindCardlibrariesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindCardlibrariesRead(client: OperationExecutor): OperationMethod<"voucher.cardlibraries.read"> { return bindOperation(client, defineOperation({"id":"voucher.cardlibraries.read","method":"GET","path":"/api/v1/vouchers/cardlibraries","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchVoucherCardlibrariesCreate(baseUrl: string): OperationMethod<"voucher.cardlibraries.create"> { return bindCardlibrariesCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindCardlibrariesCreate(client: OperationExecutor): OperationMethod<"voucher.cardlibraries.create"> { return bindOperation(client, defineOperation({"id":"voucher.cardlibraries.create","method":"POST","path":"/api/v1/vouchers/cardlibraries","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchVoucherCardlibrariesAllocate(baseUrl: string): OperationMethod<"voucher.cardlibraries.allocate"> { return bindCardlibrariesAllocate(new ApiClient(baseUrl, new FetchTransport())); }

function bindCardlibrariesAllocate(client: OperationExecutor): OperationMethod<"voucher.cardlibraries.allocate"> { return bindOperation(client, defineOperation({"id":"voucher.cardlibraries.allocate","method":"POST","path":"/api/v1/vouchers/cardlibraries/{libraryid}/allocations","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchVoucherImportsRead(baseUrl: string): OperationMethod<"voucher.imports.read"> { return bindImportsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindImportsRead(client: OperationExecutor): OperationMethod<"voucher.imports.read"> { return bindOperation(client, defineOperation({"id":"voucher.imports.read","method":"GET","path":"/api/v1/vouchers/imports/{importid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchVoucherProgramsRead(baseUrl: string): OperationMethod<"voucher.programs.read"> { return bindProgramsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindProgramsRead(client: OperationExecutor): OperationMethod<"voucher.programs.read"> { return bindOperation(client, defineOperation({"id":"voucher.programs.read","method":"GET","path":"/api/v1/vouchers/programs","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchVoucherProgramsManage(baseUrl: string): OperationMethod<"voucher.programs.manage"> { return bindProgramsManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindProgramsManage(client: OperationExecutor): OperationMethod<"voucher.programs.manage"> { return bindOperation(client, defineOperation({"id":"voucher.programs.manage","method":"PUT","path":"/api/v1/vouchers/programs/{programid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchVoucherReservesRead(baseUrl: string): OperationMethod<"voucher.reserves.read"> { return bindReservesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindReservesRead(client: OperationExecutor): OperationMethod<"voucher.reserves.read"> { return bindOperation(client, defineOperation({"id":"voucher.reserves.read","method":"GET","path":"/api/v1/vouchers/reserves","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchVoucherReservesRequest(baseUrl: string): OperationMethod<"voucher.reserves.request"> { return bindReservesRequest(new ApiClient(baseUrl, new FetchTransport())); }

function bindReservesRequest(client: OperationExecutor): OperationMethod<"voucher.reserves.request"> { return bindOperation(client, defineOperation({"id":"voucher.reserves.request","method":"POST","path":"/api/v1/vouchers/reserves","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchVoucherReservesDecide(baseUrl: string): OperationMethod<"voucher.reserves.decide"> { return bindReservesDecide(new ApiClient(baseUrl, new FetchTransport())); }

function bindReservesDecide(client: OperationExecutor): OperationMethod<"voucher.reserves.decide"> { return bindOperation(client, defineOperation({"id":"voucher.reserves.decide","method":"PUT","path":"/api/v1/vouchers/reserves/{reserveid}/decision","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchVoucherBatchesRead(baseUrl: string): OperationMethod<"voucher.batches.read"> { return bindBatchesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindBatchesRead(client: OperationExecutor): OperationMethod<"voucher.batches.read"> { return bindOperation(client, defineOperation({"id":"voucher.batches.read","method":"GET","path":"/api/v1/vouchers/batches","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchVoucherBatchesIssue(baseUrl: string): OperationMethod<"voucher.batches.issue"> { return bindBatchesIssue(new ApiClient(baseUrl, new FetchTransport())); }

function bindBatchesIssue(client: OperationExecutor): OperationMethod<"voucher.batches.issue"> { return bindOperation(client, defineOperation({"id":"voucher.batches.issue","method":"POST","path":"/api/v1/vouchers/batches","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchVoucherBatchesRetry(baseUrl: string): OperationMethod<"voucher.batches.retry"> { return bindBatchesRetry(new ApiClient(baseUrl, new FetchTransport())); }

function bindBatchesRetry(client: OperationExecutor): OperationMethod<"voucher.batches.retry"> { return bindOperation(client, defineOperation({"id":"voucher.batches.retry","method":"POST","path":"/api/v1/vouchers/batches/{batchid}/retry","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchVoucherStatusBatch(baseUrl: string): OperationMethod<"voucher.status.batch"> { return bindStatusBatch(new ApiClient(baseUrl, new FetchTransport())); }

function bindStatusBatch(client: OperationExecutor): OperationMethod<"voucher.status.batch"> { return bindOperation(client, defineOperation({"id":"voucher.status.batch","method":"POST","path":"/api/v1/vouchers/statusbatches","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchVoucherStatusbatchesRead(baseUrl: string): OperationMethod<"voucher.statusbatches.read"> { return bindStatusbatchesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindStatusbatchesRead(client: OperationExecutor): OperationMethod<"voucher.statusbatches.read"> { return bindOperation(client, defineOperation({"id":"voucher.statusbatches.read","method":"GET","path":"/api/v1/vouchers/statusbatches","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchVoucherBindingsRead(baseUrl: string): OperationMethod<"voucher.bindings.read"> { return bindBindingsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindBindingsRead(client: OperationExecutor): OperationMethod<"voucher.bindings.read"> { return bindOperation(client, defineOperation({"id":"voucher.bindings.read","method":"GET","path":"/api/v1/vouchers/bindings","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchVoucherBindingsManage(baseUrl: string): OperationMethod<"voucher.bindings.manage"> { return bindBindingsManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindBindingsManage(client: OperationExecutor): OperationMethod<"voucher.bindings.manage"> { return bindOperation(client, defineOperation({"id":"voucher.bindings.manage","method":"PUT","path":"/api/v1/vouchers/{voucherid}/binding","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }

export function createFetchVoucherRedemptionsRead(baseUrl: string): OperationMethod<"voucher.redemptions.read"> { return bindRedemptionsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindRedemptionsRead(client: OperationExecutor): OperationMethod<"voucher.redemptions.read"> { return bindOperation(client, defineOperation({"id":"voucher.redemptions.read","method":"GET","path":"/api/v1/vouchers/redemptions","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchVoucherHistoryRead(baseUrl: string): OperationMethod<"voucher.history.read"> { return bindHistoryRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindHistoryRead(client: OperationExecutor): OperationMethod<"voucher.history.read"> { return bindOperation(client, defineOperation({"id":"voucher.history.read","method":"GET","path":"/api/v1/vouchers/history","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchVoucherRedemptionsReverse(baseUrl: string): OperationMethod<"voucher.redemptions.reverse"> { return bindRedemptionsReverse(new ApiClient(baseUrl, new FetchTransport())); }

function bindRedemptionsReverse(client: OperationExecutor): OperationMethod<"voucher.redemptions.reverse"> { return bindOperation(client, defineOperation({"id":"voucher.redemptions.reverse","method":"POST","path":"/api/v1/vouchers/redemptions/{redemptionid}/reversal","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }
