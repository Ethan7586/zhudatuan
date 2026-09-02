// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import { ApiClient } from '../ApiClient';
import { FetchTransport } from '../FetchTransport';
import { bindEventOperation, bindOperation, defineOperation, type EventOperationMethod, type OperationExecutor, type OperationMethod } from '../OperationDescriptor';

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

function bindChallengesIssue(client: OperationExecutor): OperationMethod<"verification.challenges.issue"> { return bindOperation(client, defineOperation({"id":"verification.challenges.issue","method":"POST","path":"/api/v1/verifications/challenges","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchVerificationSessionsRead(baseUrl: string): OperationMethod<"verification.sessions.read"> { return bindSessionsRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindSessionsRead(client: OperationExecutor): OperationMethod<"verification.sessions.read"> { return bindOperation(client, defineOperation({"id":"verification.sessions.read","method":"GET","path":"/api/v1/verifications/sessions","audience":"storefront","targets":["storefront"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchVerificationChallengesVerify(baseUrl: string): OperationMethod<"verification.challenges.verify"> { return bindChallengesVerify(new ApiClient(baseUrl, new FetchTransport())); }

function bindChallengesVerify(client: OperationExecutor): OperationMethod<"verification.challenges.verify"> { return bindOperation(client, defineOperation({"id":"verification.challenges.verify","method":"POST","path":"/api/v1/verifications/challenges/{challengeid}/verification","audience":"console","targets":["console"],"responseMode":"json","idempotent":false,"timeout":800})); }

export function createFetchVerificationHistoryRead(baseUrl: string): OperationMethod<"verification.history.read"> { return bindHistoryRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindHistoryRead(client: OperationExecutor): OperationMethod<"verification.history.read"> { return bindOperation(client, defineOperation({"id":"verification.history.read","method":"GET","path":"/api/v1/verifications/history","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchVerificationDevicesRead(baseUrl: string): OperationMethod<"verification.devices.read"> { return bindDevicesRead(new ApiClient(baseUrl, new FetchTransport())); }

function bindDevicesRead(client: OperationExecutor): OperationMethod<"verification.devices.read"> { return bindOperation(client, defineOperation({"id":"verification.devices.read","method":"GET","path":"/api/v1/verifications/devices","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":500})); }

export function createFetchVerificationDevicesManage(baseUrl: string): OperationMethod<"verification.devices.manage"> { return bindDevicesManage(new ApiClient(baseUrl, new FetchTransport())); }

function bindDevicesManage(client: OperationExecutor): OperationMethod<"verification.devices.manage"> { return bindOperation(client, defineOperation({"id":"verification.devices.manage","method":"PUT","path":"/api/v1/verifications/devices/{deviceid}","audience":"console","targets":["console"],"responseMode":"json","idempotent":true,"timeout":800})); }
