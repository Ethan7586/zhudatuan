// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInput, exactOperationOutput } from '@shop/contract/schema';
import { defineOperation } from '../CatalogOperationDescriptor';

export const BENEFIT_OPERATION_IDS = Object.freeze([
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

export const BENEFIT_METHOD_BY_OPERATION = Object.freeze({
  "benefit.accounts.read": "accountsRead",
  "benefit.ledgers.read": "ledgersRead",
  "benefit.plans.read": "plansRead",
  "benefit.plans.manage": "plansManage",
  "benefit.budgets.read": "budgetsRead",
  "benefit.budgets.manage": "budgetsManage",
  "benefit.grants.create": "grantsCreate",
  "benefit.grants.decide": "grantsDecide",
  "benefit.grants.read": "grantsRead",
  "benefit.grants.control": "grantsControl",
  "benefit.grants.revoke": "grantsRevoke",
  "benefit.lots.read": "lotsRead",
} as const satisfies Readonly<Record<(typeof BENEFIT_OPERATION_IDS)[number], keyof BenefitOperations>>);

export function createFetchBenefit(baseUrl: string): BenefitOperations { return createBenefitOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createBenefitOperations(client: OperationExecutor): BenefitOperations { return Object.freeze({
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
  }); }

export function createFetchBenefitAccountsRead(baseUrl: string): OperationMethod<"benefit.accounts.read"> { return bindAccountsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindAccountsRead(client: OperationExecutor): OperationMethod<"benefit.accounts.read"> { return bindOperation(client, defineOperation({ ...{"id":"benefit.accounts.read","method":"GET","path":"/api/v1/benefits/accounts","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","BENEFIT_BALANCE_INSUFFICIENT","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("BenefitAccountsReadInput", [] as const, false), output: exactOperationOutput("BenefitAccountsReadOutput") })); }

export function createFetchBenefitLedgersRead(baseUrl: string): OperationMethod<"benefit.ledgers.read"> { return bindLedgersRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindLedgersRead(client: OperationExecutor): OperationMethod<"benefit.ledgers.read"> { return bindOperation(client, defineOperation({ ...{"id":"benefit.ledgers.read","method":"GET","path":"/api/v1/benefits/ledgers","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","BENEFIT_BALANCE_INSUFFICIENT","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("BenefitLedgersReadInput", [] as const, false), output: exactOperationOutput("BenefitLedgersReadOutput") })); }

export function createFetchBenefitPlansRead(baseUrl: string): OperationMethod<"benefit.plans.read"> { return bindPlansRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindPlansRead(client: OperationExecutor): OperationMethod<"benefit.plans.read"> { return bindOperation(client, defineOperation({ ...{"id":"benefit.plans.read","method":"GET","path":"/api/v1/benefits/plans","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","BENEFIT_BALANCE_INSUFFICIENT","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("BenefitPlansReadInput", [] as const, false), output: exactOperationOutput("BenefitPlansReadOutput") })); }

export function createFetchBenefitPlansManage(baseUrl: string): OperationMethod<"benefit.plans.manage"> { return bindPlansManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindPlansManage(client: OperationExecutor): OperationMethod<"benefit.plans.manage"> { return bindOperation(client, defineOperation({ ...{"id":"benefit.plans.manage","method":"PUT","path":"/api/v1/benefits/plans/{planid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","BENEFIT_BALANCE_INSUFFICIENT","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("BenefitPlansManageInput", ["planid"] as const, true), output: exactOperationOutput("BenefitPlansManageOutput") })); }

export function createFetchBenefitBudgetsRead(baseUrl: string): OperationMethod<"benefit.budgets.read"> { return bindBudgetsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindBudgetsRead(client: OperationExecutor): OperationMethod<"benefit.budgets.read"> { return bindOperation(client, defineOperation({ ...{"id":"benefit.budgets.read","method":"GET","path":"/api/v1/benefits/budgets","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","BENEFIT_BALANCE_INSUFFICIENT","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("BenefitBudgetsReadInput", [] as const, false), output: exactOperationOutput("BenefitBudgetsReadOutput") })); }

export function createFetchBenefitBudgetsManage(baseUrl: string): OperationMethod<"benefit.budgets.manage"> { return bindBudgetsManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindBudgetsManage(client: OperationExecutor): OperationMethod<"benefit.budgets.manage"> { return bindOperation(client, defineOperation({ ...{"id":"benefit.budgets.manage","method":"PUT","path":"/api/v1/benefits/budgets/{budgetid}","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","BENEFIT_BALANCE_INSUFFICIENT","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("BenefitBudgetsManageInput", ["budgetid"] as const, true), output: exactOperationOutput("BenefitBudgetsManageOutput") })); }

export function createFetchBenefitGrantsCreate(baseUrl: string): OperationMethod<"benefit.grants.create"> { return bindGrantsCreate(new ApiClient(baseUrl, new FetchTransport())); }

function bindGrantsCreate(client: OperationExecutor): OperationMethod<"benefit.grants.create"> { return bindOperation(client, defineOperation({ ...{"id":"benefit.grants.create","method":"POST","path":"/api/v1/benefits/grants","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","BENEFIT_BALANCE_INSUFFICIENT","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("BenefitGrantsCreateInput", [] as const, true), output: exactOperationOutput("BenefitGrantsCreateOutput") })); }

export function createFetchBenefitGrantsDecide(baseUrl: string): OperationMethod<"benefit.grants.decide"> { return bindGrantsDecide(new ApiClient(baseUrl, new FetchTransport())); }

function bindGrantsDecide(client: OperationExecutor): OperationMethod<"benefit.grants.decide"> { return bindOperation(client, defineOperation({ ...{"id":"benefit.grants.decide","method":"PUT","path":"/api/v1/benefits/grants/{batchid}/decision","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","BENEFIT_BALANCE_INSUFFICIENT","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInput("BenefitGrantsDecideInput", ["batchid"] as const, true), output: exactOperationOutput("BenefitGrantsDecideOutput") })); }

export function createFetchBenefitGrantsRead(baseUrl: string): OperationMethod<"benefit.grants.read"> { return bindGrantsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindGrantsRead(client: OperationExecutor): OperationMethod<"benefit.grants.read"> { return bindOperation(client, defineOperation({ ...{"id":"benefit.grants.read","method":"GET","path":"/api/v1/benefits/grants","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","BENEFIT_BALANCE_INSUFFICIENT","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("BenefitGrantsReadInput", [] as const, false), output: exactOperationOutput("BenefitGrantsReadOutput") })); }

export function createFetchBenefitGrantsControl(baseUrl: string): OperationMethod<"benefit.grants.control"> { return bindGrantsControl(new ApiClient(baseUrl, new FetchTransport())); }

function bindGrantsControl(client: OperationExecutor): OperationMethod<"benefit.grants.control"> { return bindOperation(client, defineOperation({ ...{"id":"benefit.grants.control","method":"POST","path":"/api/v1/benefits/grants/{batchid}/control","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","BENEFIT_BALANCE_INSUFFICIENT","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("BenefitGrantsControlInput", ["batchid"] as const, true), output: exactOperationOutput("BenefitGrantsControlOutput") })); }

export function createFetchBenefitGrantsRevoke(baseUrl: string): OperationMethod<"benefit.grants.revoke"> { return bindGrantsRevoke(new ApiClient(baseUrl, new FetchTransport())); }

function bindGrantsRevoke(client: OperationExecutor): OperationMethod<"benefit.grants.revoke"> { return bindOperation(client, defineOperation({ ...{"id":"benefit.grants.revoke","method":"POST","path":"/api/v1/benefits/grants/{batchid}/revoke","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["ACTION_PROOF_INVALID","ACTION_PROOF_REPLAYED","ACTION_PROOF_REQUIRED","AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","BENEFIT_BALANCE_INSUFFICIENT","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","MAKER_CHECKER_SEPARATION_REQUIRED","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("BenefitGrantsRevokeInput", ["batchid"] as const, true), output: exactOperationOutput("BenefitGrantsRevokeOutput") })); }

export function createFetchBenefitLotsRead(baseUrl: string): OperationMethod<"benefit.lots.read"> { return bindLotsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindLotsRead(client: OperationExecutor): OperationMethod<"benefit.lots.read"> { return bindOperation(client, defineOperation({ ...{"id":"benefit.lots.read","method":"GET","path":"/api/v1/benefits/lots","audience":"console","targets":["console"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","BENEFIT_BALANCE_INSUFFICIENT","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInput("BenefitLotsReadInput", [] as const, false), output: exactOperationOutput("BenefitLotsReadOutput") })); }
