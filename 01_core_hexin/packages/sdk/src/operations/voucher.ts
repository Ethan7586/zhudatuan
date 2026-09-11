// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineContractOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const VOUCHER_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
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
  "voucher.products.create",
  "voucher.products.revise",
  "voucher.products.enable",
  "voucher.products.disable",
  "voucher.products.get",
  "voucher.products.list",
  "voucher.productoptions.list",
  "voucher.credentialpools.create",
  "voucher.credentials.generate",
  "voucher.credentials.import",
  "voucher.credentialpools.close",
  "voucher.credentialpools.get",
  "voucher.credentialpools.list",
  "voucher.credentials.list",
  "voucher.credentials.get",
  "voucher.credentialexports.create",
  "voucher.jobs.get",
  "voucher.stockrequests.create",
  "voucher.stockrequests.update",
  "voucher.stockrequests.submit",
  "voucher.stockrequests.cancel",
  "voucher.stockrequests.get",
  "voucher.stockrequests.list",
  "voucher.stockrequestoptions.list",
  "voucher.issueorders.create",
  "voucher.issueorders.update",
  "voucher.issueorders.submit",
  "voucher.issueorders.cancel",
  "voucher.issueorders.get",
  "voucher.issueorders.list",
  "voucher.issuebatches.retry",
  "voucher.issuebatches.get",
  "voucher.issueorderexports.create",
  "voucher.actionbatches.create",
  "voucher.actionbatches.get",
  "voucher.actionbatches.list",
  "voucher.actionbatches.retry",
  "voucher.actionexports.create",
  "voucher.search.read",
  "voucher.activations.secret",
  "voucher.activations.numbersecret",
  "voucher.vouchers.bind",
  "voucher.vouchers.unbind",
  "voucher.vouchers.get",
  "voucher.vouchers.getbynumber",
  "voucher.vouchers.timeline",
  "voucher.redemptions.quote",
  "voucher.tenderholds.create",
  "voucher.tenderholds.consume",
  "voucher.tenderholds.release",
  "voucher.redemptions.create",
  "voucher.refunds.create",
  "voucher.redemptions.get",
  "voucher.searchfacets.read",
  "voucher.searchsnapshots.create",
  "voucher.searchexports.create",
  "voucher.exports.get",
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
  readonly productsCreate: OperationMethod<"voucher.products.create">;
  readonly productsRevise: OperationMethod<"voucher.products.revise">;
  readonly productsEnable: OperationMethod<"voucher.products.enable">;
  readonly productsDisable: OperationMethod<"voucher.products.disable">;
  readonly productsGet: OperationMethod<"voucher.products.get">;
  readonly productsList: OperationMethod<"voucher.products.list">;
  readonly productoptionsList: OperationMethod<"voucher.productoptions.list">;
  readonly credentialpoolsCreate: OperationMethod<"voucher.credentialpools.create">;
  readonly credentialsGenerate: OperationMethod<"voucher.credentials.generate">;
  readonly credentialsImport: OperationMethod<"voucher.credentials.import">;
  readonly credentialpoolsClose: OperationMethod<"voucher.credentialpools.close">;
  readonly credentialpoolsGet: OperationMethod<"voucher.credentialpools.get">;
  readonly credentialpoolsList: OperationMethod<"voucher.credentialpools.list">;
  readonly credentialsList: OperationMethod<"voucher.credentials.list">;
  readonly credentialsGet: OperationMethod<"voucher.credentials.get">;
  readonly credentialexportsCreate: OperationMethod<"voucher.credentialexports.create">;
  readonly jobsGet: OperationMethod<"voucher.jobs.get">;
  readonly stockrequestsCreate: OperationMethod<"voucher.stockrequests.create">;
  readonly stockrequestsUpdate: OperationMethod<"voucher.stockrequests.update">;
  readonly stockrequestsSubmit: OperationMethod<"voucher.stockrequests.submit">;
  readonly stockrequestsCancel: OperationMethod<"voucher.stockrequests.cancel">;
  readonly stockrequestsGet: OperationMethod<"voucher.stockrequests.get">;
  readonly stockrequestsList: OperationMethod<"voucher.stockrequests.list">;
  readonly stockrequestoptionsList: OperationMethod<"voucher.stockrequestoptions.list">;
  readonly issueordersCreate: OperationMethod<"voucher.issueorders.create">;
  readonly issueordersUpdate: OperationMethod<"voucher.issueorders.update">;
  readonly issueordersSubmit: OperationMethod<"voucher.issueorders.submit">;
  readonly issueordersCancel: OperationMethod<"voucher.issueorders.cancel">;
  readonly issueordersGet: OperationMethod<"voucher.issueorders.get">;
  readonly issueordersList: OperationMethod<"voucher.issueorders.list">;
  readonly issuebatchesRetry: OperationMethod<"voucher.issuebatches.retry">;
  readonly issuebatchesGet: OperationMethod<"voucher.issuebatches.get">;
  readonly issueorderexportsCreate: OperationMethod<"voucher.issueorderexports.create">;
  readonly actionbatchesCreate: OperationMethod<"voucher.actionbatches.create">;
  readonly actionbatchesGet: OperationMethod<"voucher.actionbatches.get">;
  readonly actionbatchesList: OperationMethod<"voucher.actionbatches.list">;
  readonly actionbatchesRetry: OperationMethod<"voucher.actionbatches.retry">;
  readonly actionexportsCreate: OperationMethod<"voucher.actionexports.create">;
  readonly searchRead: OperationMethod<"voucher.search.read">;
  readonly activationsSecret: OperationMethod<"voucher.activations.secret">;
  readonly activationsNumbersecret: OperationMethod<"voucher.activations.numbersecret">;
  readonly vouchersBind: OperationMethod<"voucher.vouchers.bind">;
  readonly vouchersUnbind: OperationMethod<"voucher.vouchers.unbind">;
  readonly vouchersGet: OperationMethod<"voucher.vouchers.get">;
  readonly vouchersGetbynumber: OperationMethod<"voucher.vouchers.getbynumber">;
  readonly vouchersTimeline: OperationMethod<"voucher.vouchers.timeline">;
  readonly redemptionsQuote: OperationMethod<"voucher.redemptions.quote">;
  readonly tenderholdsCreate: OperationMethod<"voucher.tenderholds.create">;
  readonly tenderholdsConsume: OperationMethod<"voucher.tenderholds.consume">;
  readonly tenderholdsRelease: OperationMethod<"voucher.tenderholds.release">;
  readonly redemptionsCreate: OperationMethod<"voucher.redemptions.create">;
  readonly refundsCreate: OperationMethod<"voucher.refunds.create">;
  readonly redemptionsGet: OperationMethod<"voucher.redemptions.get">;
  readonly searchfacetsRead: OperationMethod<"voucher.searchfacets.read">;
  readonly searchsnapshotsCreate: OperationMethod<"voucher.searchsnapshots.create">;
  readonly searchexportsCreate: OperationMethod<"voucher.searchexports.create">;
  readonly exportsGet: OperationMethod<"voucher.exports.get">;
}

export function createFetchVoucher(baseUrl: string): VoucherOperations {
  return createVoucherOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createVoucherOperations(client: OperationExecutor): VoucherOperations {
  return Object.freeze({
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
    productsCreate: bindProductsCreate(client),
    productsRevise: bindProductsRevise(client),
    productsEnable: bindProductsEnable(client),
    productsDisable: bindProductsDisable(client),
    productsGet: bindProductsGet(client),
    productsList: bindProductsList(client),
    productoptionsList: bindProductoptionsList(client),
    credentialpoolsCreate: bindCredentialpoolsCreate(client),
    credentialsGenerate: bindCredentialsGenerate(client),
    credentialsImport: bindCredentialsImport(client),
    credentialpoolsClose: bindCredentialpoolsClose(client),
    credentialpoolsGet: bindCredentialpoolsGet(client),
    credentialpoolsList: bindCredentialpoolsList(client),
    credentialsList: bindCredentialsList(client),
    credentialsGet: bindCredentialsGet(client),
    credentialexportsCreate: bindCredentialexportsCreate(client),
    jobsGet: bindJobsGet(client),
    stockrequestsCreate: bindStockrequestsCreate(client),
    stockrequestsUpdate: bindStockrequestsUpdate(client),
    stockrequestsSubmit: bindStockrequestsSubmit(client),
    stockrequestsCancel: bindStockrequestsCancel(client),
    stockrequestsGet: bindStockrequestsGet(client),
    stockrequestsList: bindStockrequestsList(client),
    stockrequestoptionsList: bindStockrequestoptionsList(client),
    issueordersCreate: bindIssueordersCreate(client),
    issueordersUpdate: bindIssueordersUpdate(client),
    issueordersSubmit: bindIssueordersSubmit(client),
    issueordersCancel: bindIssueordersCancel(client),
    issueordersGet: bindIssueordersGet(client),
    issueordersList: bindIssueordersList(client),
    issuebatchesRetry: bindIssuebatchesRetry(client),
    issuebatchesGet: bindIssuebatchesGet(client),
    issueorderexportsCreate: bindIssueorderexportsCreate(client),
    actionbatchesCreate: bindActionbatchesCreate(client),
    actionbatchesGet: bindActionbatchesGet(client),
    actionbatchesList: bindActionbatchesList(client),
    actionbatchesRetry: bindActionbatchesRetry(client),
    actionexportsCreate: bindActionexportsCreate(client),
    searchRead: bindSearchRead(client),
    activationsSecret: bindActivationsSecret(client),
    activationsNumbersecret: bindActivationsNumbersecret(client),
    vouchersBind: bindVouchersBind(client),
    vouchersUnbind: bindVouchersUnbind(client),
    vouchersGet: bindVouchersGet(client),
    vouchersGetbynumber: bindVouchersGetbynumber(client),
    vouchersTimeline: bindVouchersTimeline(client),
    redemptionsQuote: bindRedemptionsQuote(client),
    tenderholdsCreate: bindTenderholdsCreate(client),
    tenderholdsConsume: bindTenderholdsConsume(client),
    tenderholdsRelease: bindTenderholdsRelease(client),
    redemptionsCreate: bindRedemptionsCreate(client),
    refundsCreate: bindRefundsCreate(client),
    redemptionsGet: bindRedemptionsGet(client),
    searchfacetsRead: bindSearchfacetsRead(client),
    searchsnapshotsCreate: bindSearchsnapshotsCreate(client),
    searchexportsCreate: bindSearchexportsCreate(client),
    exportsGet: bindExportsGet(client),
  });
}

export function createFetchVoucherCardlibrariesRead(baseUrl: string): OperationMethod<"voucher.cardlibraries.read"> {
  return bindCardlibrariesRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCardlibrariesRead(client: OperationExecutor): OperationMethod<"voucher.cardlibraries.read"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.cardlibraries.read","method":"GET","path":"/api/v1/vouchers/cardlibraries","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchVoucherCardlibrariesCreate(baseUrl: string): OperationMethod<"voucher.cardlibraries.create"> {
  return bindCardlibrariesCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCardlibrariesCreate(client: OperationExecutor): OperationMethod<"voucher.cardlibraries.create"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.cardlibraries.create","method":"POST","path":"/api/v1/vouchers/cardlibraries","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchVoucherCardlibrariesAllocate(baseUrl: string): OperationMethod<"voucher.cardlibraries.allocate"> {
  return bindCardlibrariesAllocate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCardlibrariesAllocate(client: OperationExecutor): OperationMethod<"voucher.cardlibraries.allocate"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.cardlibraries.allocate","method":"POST","path":"/api/v1/vouchers/cardlibraries/{libraryid}/allocations","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchVoucherImportsRead(baseUrl: string): OperationMethod<"voucher.imports.read"> {
  return bindImportsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindImportsRead(client: OperationExecutor): OperationMethod<"voucher.imports.read"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.imports.read","method":"GET","path":"/api/v1/vouchers/imports/{importid}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchVoucherProgramsRead(baseUrl: string): OperationMethod<"voucher.programs.read"> {
  return bindProgramsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindProgramsRead(client: OperationExecutor): OperationMethod<"voucher.programs.read"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.programs.read","method":"GET","path":"/api/v1/vouchers/programs","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchVoucherProgramsManage(baseUrl: string): OperationMethod<"voucher.programs.manage"> {
  return bindProgramsManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindProgramsManage(client: OperationExecutor): OperationMethod<"voucher.programs.manage"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.programs.manage","method":"PUT","path":"/api/v1/vouchers/programs/{programid}","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchVoucherReservesRead(baseUrl: string): OperationMethod<"voucher.reserves.read"> {
  return bindReservesRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindReservesRead(client: OperationExecutor): OperationMethod<"voucher.reserves.read"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.reserves.read","method":"GET","path":"/api/v1/vouchers/reserves","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchVoucherReservesRequest(baseUrl: string): OperationMethod<"voucher.reserves.request"> {
  return bindReservesRequest(new ApiClient(baseUrl, new FetchTransport()));
}

function bindReservesRequest(client: OperationExecutor): OperationMethod<"voucher.reserves.request"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.reserves.request","method":"POST","path":"/api/v1/vouchers/reserves","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchVoucherReservesDecide(baseUrl: string): OperationMethod<"voucher.reserves.decide"> {
  return bindReservesDecide(new ApiClient(baseUrl, new FetchTransport()));
}

function bindReservesDecide(client: OperationExecutor): OperationMethod<"voucher.reserves.decide"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.reserves.decide","method":"PUT","path":"/api/v1/vouchers/reserves/{reserveid}/decision","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchVoucherBatchesRead(baseUrl: string): OperationMethod<"voucher.batches.read"> {
  return bindBatchesRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindBatchesRead(client: OperationExecutor): OperationMethod<"voucher.batches.read"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.batches.read","method":"GET","path":"/api/v1/vouchers/batches","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchVoucherBatchesIssue(baseUrl: string): OperationMethod<"voucher.batches.issue"> {
  return bindBatchesIssue(new ApiClient(baseUrl, new FetchTransport()));
}

function bindBatchesIssue(client: OperationExecutor): OperationMethod<"voucher.batches.issue"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.batches.issue","method":"POST","path":"/api/v1/vouchers/batches","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchVoucherBatchesRetry(baseUrl: string): OperationMethod<"voucher.batches.retry"> {
  return bindBatchesRetry(new ApiClient(baseUrl, new FetchTransport()));
}

function bindBatchesRetry(client: OperationExecutor): OperationMethod<"voucher.batches.retry"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.batches.retry","method":"POST","path":"/api/v1/vouchers/batches/{batchid}/retry","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchVoucherStatusBatch(baseUrl: string): OperationMethod<"voucher.status.batch"> {
  return bindStatusBatch(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStatusBatch(client: OperationExecutor): OperationMethod<"voucher.status.batch"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.status.batch","method":"POST","path":"/api/v1/vouchers/statusbatches","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchVoucherStatusbatchesRead(baseUrl: string): OperationMethod<"voucher.statusbatches.read"> {
  return bindStatusbatchesRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStatusbatchesRead(client: OperationExecutor): OperationMethod<"voucher.statusbatches.read"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.statusbatches.read","method":"GET","path":"/api/v1/vouchers/statusbatches","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchVoucherBindingsRead(baseUrl: string): OperationMethod<"voucher.bindings.read"> {
  return bindBindingsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindBindingsRead(client: OperationExecutor): OperationMethod<"voucher.bindings.read"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.bindings.read","method":"GET","path":"/api/v1/vouchers/bindings","audience":"member","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchVoucherBindingsManage(baseUrl: string): OperationMethod<"voucher.bindings.manage"> {
  return bindBindingsManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindBindingsManage(client: OperationExecutor): OperationMethod<"voucher.bindings.manage"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.bindings.manage","method":"PUT","path":"/api/v1/vouchers/{voucherid}/binding","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchVoucherRedemptionsRead(baseUrl: string): OperationMethod<"voucher.redemptions.read"> {
  return bindRedemptionsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindRedemptionsRead(client: OperationExecutor): OperationMethod<"voucher.redemptions.read"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.redemptions.read","method":"GET","path":"/api/v1/vouchers/redemptions","audience":"member","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchVoucherHistoryRead(baseUrl: string): OperationMethod<"voucher.history.read"> {
  return bindHistoryRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindHistoryRead(client: OperationExecutor): OperationMethod<"voucher.history.read"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.history.read","method":"GET","path":"/api/v1/vouchers/history","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchVoucherRedemptionsReverse(baseUrl: string): OperationMethod<"voucher.redemptions.reverse"> {
  return bindRedemptionsReverse(new ApiClient(baseUrl, new FetchTransport()));
}

function bindRedemptionsReverse(client: OperationExecutor): OperationMethod<"voucher.redemptions.reverse"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.redemptions.reverse","method":"POST","path":"/api/v1/vouchers/redemptions/{redemptionid}/reversal","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchVoucherProductsCreate(baseUrl: string): OperationMethod<"voucher.products.create"> {
  return bindProductsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindProductsCreate(client: OperationExecutor): OperationMethod<"voucher.products.create"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.products.create","method":"POST","path":"/api/v1/vouchers/products","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherProductsRevise(baseUrl: string): OperationMethod<"voucher.products.revise"> {
  return bindProductsRevise(new ApiClient(baseUrl, new FetchTransport()));
}

function bindProductsRevise(client: OperationExecutor): OperationMethod<"voucher.products.revise"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.products.revise","method":"POST","path":"/api/v1/vouchers/products/{productid}/versions","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherProductsEnable(baseUrl: string): OperationMethod<"voucher.products.enable"> {
  return bindProductsEnable(new ApiClient(baseUrl, new FetchTransport()));
}

function bindProductsEnable(client: OperationExecutor): OperationMethod<"voucher.products.enable"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.products.enable","method":"POST","path":"/api/v1/vouchers/products/{productid}/enable","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherProductsDisable(baseUrl: string): OperationMethod<"voucher.products.disable"> {
  return bindProductsDisable(new ApiClient(baseUrl, new FetchTransport()));
}

function bindProductsDisable(client: OperationExecutor): OperationMethod<"voucher.products.disable"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.products.disable","method":"POST","path":"/api/v1/vouchers/products/{productid}/disable","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherProductsGet(baseUrl: string): OperationMethod<"voucher.products.get"> {
  return bindProductsGet(new ApiClient(baseUrl, new FetchTransport()));
}

function bindProductsGet(client: OperationExecutor): OperationMethod<"voucher.products.get"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.products.get","method":"GET","path":"/api/v1/vouchers/products/{productid}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherProductsList(baseUrl: string): OperationMethod<"voucher.products.list"> {
  return bindProductsList(new ApiClient(baseUrl, new FetchTransport()));
}

function bindProductsList(client: OperationExecutor): OperationMethod<"voucher.products.list"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.products.list","method":"GET","path":"/api/v1/vouchers/products","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherProductoptionsList(baseUrl: string): OperationMethod<"voucher.productoptions.list"> {
  return bindProductoptionsList(new ApiClient(baseUrl, new FetchTransport()));
}

function bindProductoptionsList(client: OperationExecutor): OperationMethod<"voucher.productoptions.list"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.productoptions.list","method":"GET","path":"/api/v1/vouchers/product-options","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherCredentialpoolsCreate(baseUrl: string): OperationMethod<"voucher.credentialpools.create"> {
  return bindCredentialpoolsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCredentialpoolsCreate(client: OperationExecutor): OperationMethod<"voucher.credentialpools.create"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.credentialpools.create","method":"POST","path":"/api/v1/vouchers/credential-pools","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherCredentialsGenerate(baseUrl: string): OperationMethod<"voucher.credentials.generate"> {
  return bindCredentialsGenerate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCredentialsGenerate(client: OperationExecutor): OperationMethod<"voucher.credentials.generate"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.credentials.generate","method":"POST","path":"/api/v1/vouchers/credential-pools/{poolid}/generate","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"async","availability":"frozen"}));
}

export function createFetchVoucherCredentialsImport(baseUrl: string): OperationMethod<"voucher.credentials.import"> {
  return bindCredentialsImport(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCredentialsImport(client: OperationExecutor): OperationMethod<"voucher.credentials.import"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.credentials.import","method":"POST","path":"/api/v1/vouchers/credential-pools/{poolid}/imports","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"async","availability":"frozen"}));
}

export function createFetchVoucherCredentialpoolsClose(baseUrl: string): OperationMethod<"voucher.credentialpools.close"> {
  return bindCredentialpoolsClose(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCredentialpoolsClose(client: OperationExecutor): OperationMethod<"voucher.credentialpools.close"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.credentialpools.close","method":"POST","path":"/api/v1/vouchers/credential-pools/{poolid}/close","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherCredentialpoolsGet(baseUrl: string): OperationMethod<"voucher.credentialpools.get"> {
  return bindCredentialpoolsGet(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCredentialpoolsGet(client: OperationExecutor): OperationMethod<"voucher.credentialpools.get"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.credentialpools.get","method":"GET","path":"/api/v1/vouchers/credential-pools/{poolid}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherCredentialpoolsList(baseUrl: string): OperationMethod<"voucher.credentialpools.list"> {
  return bindCredentialpoolsList(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCredentialpoolsList(client: OperationExecutor): OperationMethod<"voucher.credentialpools.list"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.credentialpools.list","method":"GET","path":"/api/v1/vouchers/credential-pools","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherCredentialsList(baseUrl: string): OperationMethod<"voucher.credentials.list"> {
  return bindCredentialsList(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCredentialsList(client: OperationExecutor): OperationMethod<"voucher.credentials.list"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.credentials.list","method":"GET","path":"/api/v1/vouchers/credentials","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherCredentialsGet(baseUrl: string): OperationMethod<"voucher.credentials.get"> {
  return bindCredentialsGet(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCredentialsGet(client: OperationExecutor): OperationMethod<"voucher.credentials.get"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.credentials.get","method":"GET","path":"/api/v1/vouchers/credentials/{credentialid}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherCredentialexportsCreate(baseUrl: string): OperationMethod<"voucher.credentialexports.create"> {
  return bindCredentialexportsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindCredentialexportsCreate(client: OperationExecutor): OperationMethod<"voucher.credentialexports.create"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.credentialexports.create","method":"POST","path":"/api/v1/vouchers/credential-exports","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"none","execution":"async","availability":"frozen"}));
}

export function createFetchVoucherJobsGet(baseUrl: string): OperationMethod<"voucher.jobs.get"> {
  return bindJobsGet(new ApiClient(baseUrl, new FetchTransport()));
}

function bindJobsGet(client: OperationExecutor): OperationMethod<"voucher.jobs.get"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.jobs.get","method":"GET","path":"/api/v1/vouchers/jobs/{jobid}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherStockrequestsCreate(baseUrl: string): OperationMethod<"voucher.stockrequests.create"> {
  return bindStockrequestsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStockrequestsCreate(client: OperationExecutor): OperationMethod<"voucher.stockrequests.create"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.stockrequests.create","method":"POST","path":"/api/v1/vouchers/stock-requests","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherStockrequestsUpdate(baseUrl: string): OperationMethod<"voucher.stockrequests.update"> {
  return bindStockrequestsUpdate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStockrequestsUpdate(client: OperationExecutor): OperationMethod<"voucher.stockrequests.update"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.stockrequests.update","method":"PATCH","path":"/api/v1/vouchers/stock-requests/{requestid}","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherStockrequestsSubmit(baseUrl: string): OperationMethod<"voucher.stockrequests.submit"> {
  return bindStockrequestsSubmit(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStockrequestsSubmit(client: OperationExecutor): OperationMethod<"voucher.stockrequests.submit"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.stockrequests.submit","method":"POST","path":"/api/v1/vouchers/stock-requests/{requestid}/submit","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherStockrequestsCancel(baseUrl: string): OperationMethod<"voucher.stockrequests.cancel"> {
  return bindStockrequestsCancel(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStockrequestsCancel(client: OperationExecutor): OperationMethod<"voucher.stockrequests.cancel"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.stockrequests.cancel","method":"POST","path":"/api/v1/vouchers/stock-requests/{requestid}/cancel","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherStockrequestsGet(baseUrl: string): OperationMethod<"voucher.stockrequests.get"> {
  return bindStockrequestsGet(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStockrequestsGet(client: OperationExecutor): OperationMethod<"voucher.stockrequests.get"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.stockrequests.get","method":"GET","path":"/api/v1/vouchers/stock-requests/{requestid}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherStockrequestsList(baseUrl: string): OperationMethod<"voucher.stockrequests.list"> {
  return bindStockrequestsList(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStockrequestsList(client: OperationExecutor): OperationMethod<"voucher.stockrequests.list"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.stockrequests.list","method":"GET","path":"/api/v1/vouchers/stock-requests","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherStockrequestoptionsList(baseUrl: string): OperationMethod<"voucher.stockrequestoptions.list"> {
  return bindStockrequestoptionsList(new ApiClient(baseUrl, new FetchTransport()));
}

function bindStockrequestoptionsList(client: OperationExecutor): OperationMethod<"voucher.stockrequestoptions.list"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.stockrequestoptions.list","method":"GET","path":"/api/v1/vouchers/stock-request-options","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherIssueordersCreate(baseUrl: string): OperationMethod<"voucher.issueorders.create"> {
  return bindIssueordersCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindIssueordersCreate(client: OperationExecutor): OperationMethod<"voucher.issueorders.create"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.issueorders.create","method":"POST","path":"/api/v1/vouchers/issue-orders","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherIssueordersUpdate(baseUrl: string): OperationMethod<"voucher.issueorders.update"> {
  return bindIssueordersUpdate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindIssueordersUpdate(client: OperationExecutor): OperationMethod<"voucher.issueorders.update"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.issueorders.update","method":"PATCH","path":"/api/v1/vouchers/issue-orders/{orderid}","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherIssueordersSubmit(baseUrl: string): OperationMethod<"voucher.issueorders.submit"> {
  return bindIssueordersSubmit(new ApiClient(baseUrl, new FetchTransport()));
}

function bindIssueordersSubmit(client: OperationExecutor): OperationMethod<"voucher.issueorders.submit"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.issueorders.submit","method":"POST","path":"/api/v1/vouchers/issue-orders/{orderid}/submit","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"async","availability":"frozen"}));
}

export function createFetchVoucherIssueordersCancel(baseUrl: string): OperationMethod<"voucher.issueorders.cancel"> {
  return bindIssueordersCancel(new ApiClient(baseUrl, new FetchTransport()));
}

function bindIssueordersCancel(client: OperationExecutor): OperationMethod<"voucher.issueorders.cancel"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.issueorders.cancel","method":"POST","path":"/api/v1/vouchers/issue-orders/{orderid}/cancel","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherIssueordersGet(baseUrl: string): OperationMethod<"voucher.issueorders.get"> {
  return bindIssueordersGet(new ApiClient(baseUrl, new FetchTransport()));
}

function bindIssueordersGet(client: OperationExecutor): OperationMethod<"voucher.issueorders.get"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.issueorders.get","method":"GET","path":"/api/v1/vouchers/issue-orders/{orderid}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherIssueordersList(baseUrl: string): OperationMethod<"voucher.issueorders.list"> {
  return bindIssueordersList(new ApiClient(baseUrl, new FetchTransport()));
}

function bindIssueordersList(client: OperationExecutor): OperationMethod<"voucher.issueorders.list"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.issueorders.list","method":"GET","path":"/api/v1/vouchers/issue-orders","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherIssuebatchesRetry(baseUrl: string): OperationMethod<"voucher.issuebatches.retry"> {
  return bindIssuebatchesRetry(new ApiClient(baseUrl, new FetchTransport()));
}

function bindIssuebatchesRetry(client: OperationExecutor): OperationMethod<"voucher.issuebatches.retry"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.issuebatches.retry","method":"POST","path":"/api/v1/vouchers/issue-batches/{batchid}/retry","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"async","availability":"frozen"}));
}

export function createFetchVoucherIssuebatchesGet(baseUrl: string): OperationMethod<"voucher.issuebatches.get"> {
  return bindIssuebatchesGet(new ApiClient(baseUrl, new FetchTransport()));
}

function bindIssuebatchesGet(client: OperationExecutor): OperationMethod<"voucher.issuebatches.get"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.issuebatches.get","method":"GET","path":"/api/v1/vouchers/issue-batches/{batchid}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherIssueorderexportsCreate(baseUrl: string): OperationMethod<"voucher.issueorderexports.create"> {
  return bindIssueorderexportsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindIssueorderexportsCreate(client: OperationExecutor): OperationMethod<"voucher.issueorderexports.create"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.issueorderexports.create","method":"POST","path":"/api/v1/vouchers/issue-order-exports","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"none","execution":"async","availability":"frozen"}));
}

export function createFetchVoucherActionbatchesCreate(baseUrl: string): OperationMethod<"voucher.actionbatches.create"> {
  return bindActionbatchesCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindActionbatchesCreate(client: OperationExecutor): OperationMethod<"voucher.actionbatches.create"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.actionbatches.create","method":"POST","path":"/api/v1/vouchers/action-batches","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"none","execution":"async","availability":"frozen"}));
}

export function createFetchVoucherActionbatchesGet(baseUrl: string): OperationMethod<"voucher.actionbatches.get"> {
  return bindActionbatchesGet(new ApiClient(baseUrl, new FetchTransport()));
}

function bindActionbatchesGet(client: OperationExecutor): OperationMethod<"voucher.actionbatches.get"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.actionbatches.get","method":"GET","path":"/api/v1/vouchers/action-batches/{actionbatchid}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherActionbatchesList(baseUrl: string): OperationMethod<"voucher.actionbatches.list"> {
  return bindActionbatchesList(new ApiClient(baseUrl, new FetchTransport()));
}

function bindActionbatchesList(client: OperationExecutor): OperationMethod<"voucher.actionbatches.list"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.actionbatches.list","method":"GET","path":"/api/v1/vouchers/action-batches","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherActionbatchesRetry(baseUrl: string): OperationMethod<"voucher.actionbatches.retry"> {
  return bindActionbatchesRetry(new ApiClient(baseUrl, new FetchTransport()));
}

function bindActionbatchesRetry(client: OperationExecutor): OperationMethod<"voucher.actionbatches.retry"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.actionbatches.retry","method":"POST","path":"/api/v1/vouchers/action-batches/{actionbatchid}/retry","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"async","availability":"frozen"}));
}

export function createFetchVoucherActionexportsCreate(baseUrl: string): OperationMethod<"voucher.actionexports.create"> {
  return bindActionexportsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindActionexportsCreate(client: OperationExecutor): OperationMethod<"voucher.actionexports.create"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.actionexports.create","method":"POST","path":"/api/v1/vouchers/action-exports","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"none","execution":"async","availability":"frozen"}));
}

export function createFetchVoucherSearchRead(baseUrl: string): OperationMethod<"voucher.search.read"> {
  return bindSearchRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindSearchRead(client: OperationExecutor): OperationMethod<"voucher.search.read"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.search.read","method":"GET","path":"/api/v1/vouchers/search","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherActivationsSecret(baseUrl: string): OperationMethod<"voucher.activations.secret"> {
  return bindActivationsSecret(new ApiClient(baseUrl, new FetchTransport()));
}

function bindActivationsSecret(client: OperationExecutor): OperationMethod<"voucher.activations.secret"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.activations.secret","method":"POST","path":"/api/v1/vouchers/activation/secret","audience":"public","idempotent":false,"idempotency":"required","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherActivationsNumbersecret(baseUrl: string): OperationMethod<"voucher.activations.numbersecret"> {
  return bindActivationsNumbersecret(new ApiClient(baseUrl, new FetchTransport()));
}

function bindActivationsNumbersecret(client: OperationExecutor): OperationMethod<"voucher.activations.numbersecret"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.activations.numbersecret","method":"POST","path":"/api/v1/vouchers/activation/number-secret","audience":"public","idempotent":false,"idempotency":"required","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherVouchersBind(baseUrl: string): OperationMethod<"voucher.vouchers.bind"> {
  return bindVouchersBind(new ApiClient(baseUrl, new FetchTransport()));
}

function bindVouchersBind(client: OperationExecutor): OperationMethod<"voucher.vouchers.bind"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.vouchers.bind","method":"POST","path":"/api/v1/vouchers/{voucherid}/bind","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherVouchersUnbind(baseUrl: string): OperationMethod<"voucher.vouchers.unbind"> {
  return bindVouchersUnbind(new ApiClient(baseUrl, new FetchTransport()));
}

function bindVouchersUnbind(client: OperationExecutor): OperationMethod<"voucher.vouchers.unbind"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.vouchers.unbind","method":"POST","path":"/api/v1/vouchers/{voucherid}/unbind","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherVouchersGet(baseUrl: string): OperationMethod<"voucher.vouchers.get"> {
  return bindVouchersGet(new ApiClient(baseUrl, new FetchTransport()));
}

function bindVouchersGet(client: OperationExecutor): OperationMethod<"voucher.vouchers.get"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.vouchers.get","method":"GET","path":"/api/v1/vouchers/{voucherid}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherVouchersGetbynumber(baseUrl: string): OperationMethod<"voucher.vouchers.getbynumber"> {
  return bindVouchersGetbynumber(new ApiClient(baseUrl, new FetchTransport()));
}

function bindVouchersGetbynumber(client: OperationExecutor): OperationMethod<"voucher.vouchers.getbynumber"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.vouchers.getbynumber","method":"GET","path":"/api/v1/vouchers/by-number/{number}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherVouchersTimeline(baseUrl: string): OperationMethod<"voucher.vouchers.timeline"> {
  return bindVouchersTimeline(new ApiClient(baseUrl, new FetchTransport()));
}

function bindVouchersTimeline(client: OperationExecutor): OperationMethod<"voucher.vouchers.timeline"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.vouchers.timeline","method":"GET","path":"/api/v1/vouchers/{voucherid}/timeline","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherRedemptionsQuote(baseUrl: string): OperationMethod<"voucher.redemptions.quote"> {
  return bindRedemptionsQuote(new ApiClient(baseUrl, new FetchTransport()));
}

function bindRedemptionsQuote(client: OperationExecutor): OperationMethod<"voucher.redemptions.quote"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.redemptions.quote","method":"POST","path":"/api/v1/vouchers/redemptions/quote","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherTenderholdsCreate(baseUrl: string): OperationMethod<"voucher.tenderholds.create"> {
  return bindTenderholdsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindTenderholdsCreate(client: OperationExecutor): OperationMethod<"voucher.tenderholds.create"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.tenderholds.create","method":"POST","path":"/api/v1/vouchers/tender-holds","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherTenderholdsConsume(baseUrl: string): OperationMethod<"voucher.tenderholds.consume"> {
  return bindTenderholdsConsume(new ApiClient(baseUrl, new FetchTransport()));
}

function bindTenderholdsConsume(client: OperationExecutor): OperationMethod<"voucher.tenderholds.consume"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.tenderholds.consume","method":"POST","path":"/api/v1/vouchers/tender-holds/{holdid}/consume","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherTenderholdsRelease(baseUrl: string): OperationMethod<"voucher.tenderholds.release"> {
  return bindTenderholdsRelease(new ApiClient(baseUrl, new FetchTransport()));
}

function bindTenderholdsRelease(client: OperationExecutor): OperationMethod<"voucher.tenderholds.release"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.tenderholds.release","method":"POST","path":"/api/v1/vouchers/tender-holds/{holdid}/release","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherRedemptionsCreate(baseUrl: string): OperationMethod<"voucher.redemptions.create"> {
  return bindRedemptionsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindRedemptionsCreate(client: OperationExecutor): OperationMethod<"voucher.redemptions.create"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.redemptions.create","method":"POST","path":"/api/v1/vouchers/redemptions","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherRefundsCreate(baseUrl: string): OperationMethod<"voucher.refunds.create"> {
  return bindRefundsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindRefundsCreate(client: OperationExecutor): OperationMethod<"voucher.refunds.create"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.refunds.create","method":"POST","path":"/api/v1/vouchers/redemptions/{redemptionid}/refunds","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"required","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherRedemptionsGet(baseUrl: string): OperationMethod<"voucher.redemptions.get"> {
  return bindRedemptionsGet(new ApiClient(baseUrl, new FetchTransport()));
}

function bindRedemptionsGet(client: OperationExecutor): OperationMethod<"voucher.redemptions.get"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.redemptions.get","method":"GET","path":"/api/v1/vouchers/redemptions/{redemptionid}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherSearchfacetsRead(baseUrl: string): OperationMethod<"voucher.searchfacets.read"> {
  return bindSearchfacetsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindSearchfacetsRead(client: OperationExecutor): OperationMethod<"voucher.searchfacets.read"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.searchfacets.read","method":"GET","path":"/api/v1/vouchers/search/facets","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherSearchsnapshotsCreate(baseUrl: string): OperationMethod<"voucher.searchsnapshots.create"> {
  return bindSearchsnapshotsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindSearchsnapshotsCreate(client: OperationExecutor): OperationMethod<"voucher.searchsnapshots.create"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.searchsnapshots.create","method":"POST","path":"/api/v1/vouchers/search-snapshots","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}

export function createFetchVoucherSearchexportsCreate(baseUrl: string): OperationMethod<"voucher.searchexports.create"> {
  return bindSearchexportsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindSearchexportsCreate(client: OperationExecutor): OperationMethod<"voucher.searchexports.create"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.searchexports.create","method":"POST","path":"/api/v1/vouchers/search-exports","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"none","execution":"async","availability":"frozen"}));
}

export function createFetchVoucherExportsGet(baseUrl: string): OperationMethod<"voucher.exports.get"> {
  return bindExportsGet(new ApiClient(baseUrl, new FetchTransport()));
}

function bindExportsGet(client: OperationExecutor): OperationMethod<"voucher.exports.get"> {
  return bindOperation(client, defineContractOperation({"id":"voucher.exports.get","method":"GET","path":"/api/v1/vouchers/exports/{exportid}","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"frozen"}));
}
