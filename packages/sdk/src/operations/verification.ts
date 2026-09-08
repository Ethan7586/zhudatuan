// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindOperation, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';
import { exactOperationInputFrom, exactOperationOutputFrom } from '@shop/contract/operationschema';
import { VERIFICATION_BODY_SCHEMAS, VERIFICATION_QUERY_SCHEMAS, VERIFICATION_OUTPUT_SCHEMAS } from '@shop/contract/schema/Verification';
import { defineOperation } from '../CatalogOperationDescriptor';

export const VERIFICATION_OPERATION_IDS = Object.freeze([
  "verification.challenges.issue",
  "verification.sessions.read",
  "verification.challenges.verify",
  "verification.history.read",
  "verification.devices.read",
  "verification.devices.manage",
] as const satisfies readonly OperationId[]);

export interface VerificationOperations {
  readonly challengesIssue: OperationMethod<"verification.challenges.issue">;
  readonly sessionsRead: OperationMethod<"verification.sessions.read">;
  readonly challengesVerify: OperationMethod<"verification.challenges.verify">;
  readonly historyRead: OperationMethod<"verification.history.read">;
  readonly devicesRead: OperationMethod<"verification.devices.read">;
  readonly devicesManage: OperationMethod<"verification.devices.manage">;
}

export const VERIFICATION_METHOD_BY_OPERATION = Object.freeze({
  "verification.challenges.issue": "challengesIssue",
  "verification.sessions.read": "sessionsRead",
  "verification.challenges.verify": "challengesVerify",
  "verification.history.read": "historyRead",
  "verification.devices.read": "devicesRead",
  "verification.devices.manage": "devicesManage",
} as const satisfies Readonly<Record<(typeof VERIFICATION_OPERATION_IDS)[number], keyof VerificationOperations>>);

export function createFetchVerification(baseUrl: string): VerificationOperations { return createVerificationOperations(new ApiClient(baseUrl, new FetchTransport())); }

export function createVerificationOperations(client: OperationExecutor): VerificationOperations { return Object.freeze({
    challengesIssue: bindChallengesIssue(client),
    sessionsRead: bindSessionsRead(client),
    challengesVerify: bindChallengesVerify(client),
    historyRead: bindHistoryRead(client),
    devicesRead: bindDevicesRead(client),
    devicesManage: bindDevicesManage(client),
  }); }

export function createFetchVerificationChallengesIssue(baseUrl: string): OperationMethod<"verification.challenges.issue"> { return bindChallengesIssue(new ApiClient(baseUrl, new FetchTransport())); }

export function bindChallengesIssue(client: OperationExecutor): OperationMethod<"verification.challenges.issue"> { return bindOperation(client, defineOperation({ ...{"id":"verification.challenges.issue","method":"POST","path":"/api/v1/verifications/challenges","audience":"console","targets":["console","store"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VOUCHER_NOT_REDEEMABLE"]}, input: exactOperationInputFrom(VERIFICATION_BODY_SCHEMAS.VerificationChallengesIssueInput, [] as const, true), output: exactOperationOutputFrom(VERIFICATION_OUTPUT_SCHEMAS.VerificationChallengesIssueOutput) })); }

export function createFetchVerificationSessionsRead(baseUrl: string): OperationMethod<"verification.sessions.read"> { return bindSessionsRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindSessionsRead(client: OperationExecutor): OperationMethod<"verification.sessions.read"> { return bindOperation(client, defineOperation({ ...{"id":"verification.sessions.read","method":"GET","path":"/api/v1/verifications/sessions","audience":"storefront","targets":["storefront","miniapp"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(VERIFICATION_QUERY_SCHEMAS.VerificationSessionsReadInput, [] as const, false), output: exactOperationOutputFrom(VERIFICATION_OUTPUT_SCHEMAS.VerificationSessionsReadOutput) })); }

export function createFetchVerificationChallengesVerify(baseUrl: string): OperationMethod<"verification.challenges.verify"> { return bindChallengesVerify(new ApiClient(baseUrl, new FetchTransport())); }

export function bindChallengesVerify(client: OperationExecutor): OperationMethod<"verification.challenges.verify"> { return bindOperation(client, defineOperation({ ...{"id":"verification.challenges.verify","method":"POST","path":"/api/v1/verifications/challenges/{challengeid}/verification","audience":"console","targets":["console","store"],"responseMode":"json","idempotencyPolicy":"required","idempotent":false,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERIFICATION_DEVICE_DENIED","VERIFICATION_TOKEN_INVALID","VOUCHER_REDEMPTION_CONFLICT"]}, input: exactOperationInputFrom(VERIFICATION_BODY_SCHEMAS.VerificationChallengesVerifyInput, ["challengeid"] as const, true), output: exactOperationOutputFrom(VERIFICATION_OUTPUT_SCHEMAS.VerificationChallengesVerifyOutput) })); }

export function createFetchVerificationHistoryRead(baseUrl: string): OperationMethod<"verification.history.read"> { return bindHistoryRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindHistoryRead(client: OperationExecutor): OperationMethod<"verification.history.read"> { return bindOperation(client, defineOperation({ ...{"id":"verification.history.read","method":"GET","path":"/api/v1/verifications/history","audience":"console","targets":["console","store"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(VERIFICATION_QUERY_SCHEMAS.VerificationHistoryReadInput, [] as const, false), output: exactOperationOutputFrom(VERIFICATION_OUTPUT_SCHEMAS.VerificationHistoryReadOutput) })); }

export function createFetchVerificationDevicesRead(baseUrl: string): OperationMethod<"verification.devices.read"> { return bindDevicesRead(new ApiClient(baseUrl, new FetchTransport())); }

export function bindDevicesRead(client: OperationExecutor): OperationMethod<"verification.devices.read"> { return bindOperation(client, defineOperation({ ...{"id":"verification.devices.read","method":"GET","path":"/api/v1/verifications/devices","audience":"console","targets":["console","store"],"responseMode":"json","idempotencyPolicy":"none","idempotent":true,"timeout":500,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTRACT_VERSION_UNSUPPORTED","DEADLINE_EXCEEDED","INTERNAL_ERROR","PERMISSION_DENIED","RATE_LIMITED","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED"]}, input: exactOperationInputFrom(VERIFICATION_QUERY_SCHEMAS.VerificationDevicesReadInput, [] as const, false), output: exactOperationOutputFrom(VERIFICATION_OUTPUT_SCHEMAS.VerificationDevicesReadOutput) })); }

export function createFetchVerificationDevicesManage(baseUrl: string): OperationMethod<"verification.devices.manage"> { return bindDevicesManage(new ApiClient(baseUrl, new FetchTransport())); }

export function bindDevicesManage(client: OperationExecutor): OperationMethod<"verification.devices.manage"> { return bindOperation(client, defineOperation({ ...{"id":"verification.devices.manage","method":"PUT","path":"/api/v1/verifications/devices/{deviceid}","audience":"console","targets":["console","store"],"responseMode":"json","idempotencyPolicy":"required","idempotent":true,"timeout":800,"errorUnion":["AUTHENTICATION_REQUIRED","AUTHORIZATION_DENIED","CAPABILITY_DENIED","CONTENT_TYPE_UNSUPPORTED","CONTRACT_VERSION_UNSUPPORTED","CSRF_TOKEN_INVALID","DEADLINE_EXCEEDED","EXPECTED_VERSION_INVALID","EXPECTED_VERSION_REQUIRED","IDEMPOTENCY_CONFLICT","IDEMPOTENCY_KEY_REQUIRED","INTERNAL_ERROR","ORIGIN_REQUIRED","PERMISSION_DENIED","RATE_LIMITED","REQUEST_BODY_TOO_LARGE","REQUEST_JSON_INVALID","SCOPE_DENIED","STEPUP_REQUIRED","URL_SENSITIVE_DATA_FORBIDDEN","VALIDATION_FAILED","VERSION_CONFLICT"]}, input: exactOperationInputFrom(VERIFICATION_BODY_SCHEMAS.VerificationDevicesManageInput, ["deviceid"] as const, true), output: exactOperationOutputFrom(VERIFICATION_OUTPUT_SCHEMAS.VerificationDevicesManageOutput) })); }
