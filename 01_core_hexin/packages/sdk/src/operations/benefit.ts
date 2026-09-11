// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, defineContractOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

export const BENEFIT_OPERATION_IDS = /* @__PURE__ */ Object.freeze([
  "benefit.accounts.read",
  "benefit.ledgers.read",
  "benefit.plans.read",
  "benefit.plans.manage",
  "benefit.budgets.read",
  "benefit.budgets.manage",
  "benefit.grants.create",
  "benefit.grants.decide",
  "benefit.grants.read",
  "benefit.grants.control",
  "benefit.grants.revoke",
  "benefit.lots.read",
] as const satisfies readonly OperationId[]);

export interface BenefitOperations {
  readonly accountsRead: OperationMethod<"benefit.accounts.read">;
  readonly ledgersRead: OperationMethod<"benefit.ledgers.read">;
  readonly plansRead: OperationMethod<"benefit.plans.read">;
  readonly plansManage: OperationMethod<"benefit.plans.manage">;
  readonly budgetsRead: OperationMethod<"benefit.budgets.read">;
  readonly budgetsManage: OperationMethod<"benefit.budgets.manage">;
  readonly grantsCreate: OperationMethod<"benefit.grants.create">;
  readonly grantsDecide: OperationMethod<"benefit.grants.decide">;
  readonly grantsRead: OperationMethod<"benefit.grants.read">;
  readonly grantsControl: OperationMethod<"benefit.grants.control">;
  readonly grantsRevoke: OperationMethod<"benefit.grants.revoke">;
  readonly lotsRead: OperationMethod<"benefit.lots.read">;
}

export function createFetchBenefit(baseUrl: string): BenefitOperations {
  return createBenefitOperations(new ApiClient(baseUrl, new FetchTransport()));
}

export function createBenefitOperations(client: OperationExecutor): BenefitOperations {
  return Object.freeze({
    accountsRead: bindAccountsRead(client),
    ledgersRead: bindLedgersRead(client),
    plansRead: bindPlansRead(client),
    plansManage: bindPlansManage(client),
    budgetsRead: bindBudgetsRead(client),
    budgetsManage: bindBudgetsManage(client),
    grantsCreate: bindGrantsCreate(client),
    grantsDecide: bindGrantsDecide(client),
    grantsRead: bindGrantsRead(client),
    grantsControl: bindGrantsControl(client),
    grantsRevoke: bindGrantsRevoke(client),
    lotsRead: bindLotsRead(client),
  });
}

export function createFetchBenefitAccountsRead(baseUrl: string): OperationMethod<"benefit.accounts.read"> {
  return bindAccountsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindAccountsRead(client: OperationExecutor): OperationMethod<"benefit.accounts.read"> {
  return bindOperation(client, defineContractOperation({"id":"benefit.accounts.read","method":"GET","path":"/api/v1/benefits/accounts","audience":"member","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchBenefitLedgersRead(baseUrl: string): OperationMethod<"benefit.ledgers.read"> {
  return bindLedgersRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindLedgersRead(client: OperationExecutor): OperationMethod<"benefit.ledgers.read"> {
  return bindOperation(client, defineContractOperation({"id":"benefit.ledgers.read","method":"GET","path":"/api/v1/benefits/ledgers","audience":"member","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchBenefitPlansRead(baseUrl: string): OperationMethod<"benefit.plans.read"> {
  return bindPlansRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindPlansRead(client: OperationExecutor): OperationMethod<"benefit.plans.read"> {
  return bindOperation(client, defineContractOperation({"id":"benefit.plans.read","method":"GET","path":"/api/v1/benefits/plans","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchBenefitPlansManage(baseUrl: string): OperationMethod<"benefit.plans.manage"> {
  return bindPlansManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindPlansManage(client: OperationExecutor): OperationMethod<"benefit.plans.manage"> {
  return bindOperation(client, defineContractOperation({"id":"benefit.plans.manage","method":"PUT","path":"/api/v1/benefits/plans/{planid}","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchBenefitBudgetsRead(baseUrl: string): OperationMethod<"benefit.budgets.read"> {
  return bindBudgetsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindBudgetsRead(client: OperationExecutor): OperationMethod<"benefit.budgets.read"> {
  return bindOperation(client, defineContractOperation({"id":"benefit.budgets.read","method":"GET","path":"/api/v1/benefits/budgets","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchBenefitBudgetsManage(baseUrl: string): OperationMethod<"benefit.budgets.manage"> {
  return bindBudgetsManage(new ApiClient(baseUrl, new FetchTransport()));
}

function bindBudgetsManage(client: OperationExecutor): OperationMethod<"benefit.budgets.manage"> {
  return bindOperation(client, defineContractOperation({"id":"benefit.budgets.manage","method":"PUT","path":"/api/v1/benefits/budgets/{budgetid}","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchBenefitGrantsCreate(baseUrl: string): OperationMethod<"benefit.grants.create"> {
  return bindGrantsCreate(new ApiClient(baseUrl, new FetchTransport()));
}

function bindGrantsCreate(client: OperationExecutor): OperationMethod<"benefit.grants.create"> {
  return bindOperation(client, defineContractOperation({"id":"benefit.grants.create","method":"POST","path":"/api/v1/benefits/grants","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchBenefitGrantsDecide(baseUrl: string): OperationMethod<"benefit.grants.decide"> {
  return bindGrantsDecide(new ApiClient(baseUrl, new FetchTransport()));
}

function bindGrantsDecide(client: OperationExecutor): OperationMethod<"benefit.grants.decide"> {
  return bindOperation(client, defineContractOperation({"id":"benefit.grants.decide","method":"PUT","path":"/api/v1/benefits/grants/{batchid}/decision","audience":"operator","idempotent":true,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchBenefitGrantsRead(baseUrl: string): OperationMethod<"benefit.grants.read"> {
  return bindGrantsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindGrantsRead(client: OperationExecutor): OperationMethod<"benefit.grants.read"> {
  return bindOperation(client, defineContractOperation({"id":"benefit.grants.read","method":"GET","path":"/api/v1/benefits/grants","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}

export function createFetchBenefitGrantsControl(baseUrl: string): OperationMethod<"benefit.grants.control"> {
  return bindGrantsControl(new ApiClient(baseUrl, new FetchTransport()));
}

function bindGrantsControl(client: OperationExecutor): OperationMethod<"benefit.grants.control"> {
  return bindOperation(client, defineContractOperation({"id":"benefit.grants.control","method":"POST","path":"/api/v1/benefits/grants/{batchid}/control","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchBenefitGrantsRevoke(baseUrl: string): OperationMethod<"benefit.grants.revoke"> {
  return bindGrantsRevoke(new ApiClient(baseUrl, new FetchTransport()));
}

function bindGrantsRevoke(client: OperationExecutor): OperationMethod<"benefit.grants.revoke"> {
  return bindOperation(client, defineContractOperation({"id":"benefit.grants.revoke","method":"POST","path":"/api/v1/benefits/grants/{batchid}/revoke","audience":"operator","idempotent":false,"idempotency":"required","expectedVersion":"optional","execution":"sync","availability":"runtime"}));
}

export function createFetchBenefitLotsRead(baseUrl: string): OperationMethod<"benefit.lots.read"> {
  return bindLotsRead(new ApiClient(baseUrl, new FetchTransport()));
}

function bindLotsRead(client: OperationExecutor): OperationMethod<"benefit.lots.read"> {
  return bindOperation(client, defineContractOperation({"id":"benefit.lots.read","method":"GET","path":"/api/v1/benefits/lots","audience":"operator","idempotent":true,"idempotency":"none","expectedVersion":"none","execution":"sync","availability":"runtime"}));
}
