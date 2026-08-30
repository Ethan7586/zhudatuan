import type { ScopeKind } from '@shop/authz';
import { createIdempotencyKey, createRequestContext } from '@shop/sdk/context';
import { createFetchIdentitySessionDelete, createFetchIdentitySessionRead } from '@shop/sdk/identity';
import { createFetchMemberProfileRead } from '@shop/sdk/member';
import { createFetchOrganizationLayersRead } from '@shop/sdk/organization';
import { appConfig } from '../config/AppConfig';

export interface ConsoleRequestScope {
  readonly kind: ScopeKind;
  readonly id: string;
}

export const identitySessionRead = createFetchIdentitySessionRead(appConfig.apiBaseUrl);
export const identitySessionDelete = createFetchIdentitySessionDelete(appConfig.apiBaseUrl);
export const memberProfileRead = createFetchMemberProfileRead(appConfig.apiBaseUrl);
export const organizationLayersRead = createFetchOrganizationLayersRead(appConfig.apiBaseUrl);

export function consoleRequest(
  scope: ConsoleRequestScope | undefined,
  signal?: AbortSignal,
  accessVersion?: number,
) {
  return createRequestContext(appConfig.clientVersion, {
    ...(scope === undefined ? {} : { scope }),
    ...(signal === undefined ? {} : { signal }),
    ...(accessVersion === undefined ? {} : { accessVersion }),
  });
}

export function consoleCommand(
  scope: ConsoleRequestScope | undefined,
  options: Readonly<{
    signal?: AbortSignal;
    accessVersion?: number;
    expectedVersion?: number;
    proof?: string;
    csrfToken?: string;
  }> = {},
) {
  return createRequestContext(appConfig.clientVersion, {
    ...(scope === undefined ? {} : { scope }),
    idempotencyKey: createIdempotencyKey(),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    ...(options.accessVersion === undefined ? {} : { accessVersion: options.accessVersion }),
    ...(options.expectedVersion === undefined ? {} : { expectedVersion: options.expectedVersion }),
    ...(options.proof === undefined ? {} : { proof: options.proof }),
    ...(options.csrfToken === undefined ? {} : { csrfToken: options.csrfToken }),
  });
}
