import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LocalHttpError } from './Http';
import { loadFullStagingWorkloadAccessPolicy, parseFullStagingWorkloadAccessPolicy } from './WorkloadAccessPolicy';

const secretApi = 'a'.repeat(43);
const secretIdentityJobs = 'b'.repeat(43);
const secretFullJobs = 'c'.repeat(43);
const kmsApi = 'd'.repeat(43);
const kmsIdentityJobs = 'e'.repeat(43);
const kmsFullJobs = 'f'.repeat(43);

describe('full staging workload access policy', () => {
  it('refuses to load the live policy from the shared source or another unit credential directory', async () => {
    await assert.rejects(
      loadFullStagingWorkloadAccessPolicy('/opt/zhudatuan-staging-full/shared/full-internal-access.json'),
      /FULL_STAGING_WORKLOAD_ACCESS_POLICY_FILE_INVALID/,
    );
    await assert.rejects(
      loadFullStagingWorkloadAccessPolicy('/run/credentials/other.service/workload-access-policy'),
      /FULL_STAGING_WORKLOAD_ACCESS_POLICY_FILE_INVALID/,
    );
  });

  it('authorizes only the exact runtime refs assigned to a distinct workload bearer', () => {
    const policy = parseFullStagingWorkloadAccessPolicy(runtimePolicy());
    const api = policy.secretStore.authenticate(headers(secretApi));
    policy.secretStore.require(api, 'zhudatuan/staging/full/database/identity-api');
    assertDenied(() => policy.secretStore.require(api, 'zhudatuan/staging/full/database/jobs'));
    assertDenied(() => policy.secretStore.require(api, 'zhudatuan/staging/full/registration/owner/password'));

    const identityJobs = policy.kms.authenticate(headers(kmsIdentityJobs));
    policy.kms.require(identityJobs, 'identity/challenge');
    assertDenied(() => policy.kms.require(identityJobs, 'voucher/code'));
  });

  it('rejects unknown tokens, duplicate tokens, wildcard-like resources and broadened grants', () => {
    const policy = parseFullStagingWorkloadAccessPolicy(runtimePolicy());
    assert.throws(() => policy.secretStore.authenticate(headers('z'.repeat(43))), authenticationRequired);
    assert.throws(() => parseFullStagingWorkloadAccessPolicy(runtimePolicy({ identityJobsSecret: secretApi })), /TOKEN_REUSED/);
    const wildcard = runtimePolicy();
    wildcard.secretStore['identity-registration-api']!.resources.push('zhudatuan/staging/full/*');
    assert.throws(() => parseFullStagingWorkloadAccessPolicy(wildcard), /RESOURCE_INVALID|BOUNDARY_INVALID/);
    const broadened = runtimePolicy();
    broadened.secretStore['identity-registration-api']!.resources.push('zhudatuan/staging/full/database/migration');
    assert.throws(() => parseFullStagingWorkloadAccessPolicy(broadened), /BOUNDARY_INVALID/);
  });

  it('rejects reusing an Object Store bearer without revealing a policy token', () => {
    const policy = parseFullStagingWorkloadAccessPolicy(runtimePolicy());
    assert.throws(() => policy.assertTokenNotReused(secretFullJobs), /FULL_STAGING_WORKLOAD_TOKEN_REUSED/);
    assert.doesNotThrow(() => policy.assertTokenNotReused('o'.repeat(43)));
  });
});

function runtimePolicy(overrides: { readonly identityJobsSecret?: string } = {}) {
  return {
    version: 1,
    phase: 'runtime',
    secretStore: {
      'identity-registration-api': grant(secretApi, [
        'zhudatuan/staging/full/database/identity-api',
        'zhudatuan/staging/full/identity/index',
        'zhudatuan/staging/full/identity/session',
      ]),
      'identity-notification-jobs': grant(overrides.identityJobsSecret ?? secretIdentityJobs, [
        'zhudatuan/staging/full/database/identity-notification-jobs',
        'zhudatuan/staging/full/notification/identity-sms',
      ]),
      'full-jobs': grant(secretFullJobs, [
        'zhudatuan/staging/full/database/jobs',
        'zhudatuan/staging/full/extensions/manifest',
        'zhudatuan/staging/full/invoice/provider',
        'zhudatuan/staging/full/notification/providers',
        'zhudatuan/staging/full/objects/jobs',
        'zhudatuan/staging/full/payment/wechat',
        'zhudatuan/staging/full/payout/provider',
        'zhudatuan/staging/full/redis/jobs',
        'zhudatuan/staging/full/wechat/applications',
      ]),
    },
    kms: {
      'identity-registration-api': grant(kmsApi, ['identity/challenge', 'identity/destination', 'identity/mobile']),
      'identity-notification-jobs': grant(kmsIdentityJobs, ['identity/challenge', 'identity/destination', 'identity/mobile']),
      'full-jobs': grant(kmsFullJobs, [
        'audit/archive', 'identity/challenge', 'identity/destination', 'notification/recipient', 'pii/invoice', 'voucher/code',
      ]),
    },
  };
}

function grant(bearerToken: string, resources: string[]) {
  return { bearerToken, resources };
}

function headers(token: string): Readonly<Record<string, string>> {
  return { authorization: `Bearer ${token}` };
}

function assertDenied(operation: () => void): void {
  assert.throws(operation, (cause: unknown) => cause instanceof LocalHttpError
    && cause.status === 403 && cause.code === 'WORKLOAD_AUTHORIZATION_DENIED');
}

function authenticationRequired(cause: unknown): boolean {
  return cause instanceof LocalHttpError && cause.status === 401 && cause.code === 'WORKLOAD_AUTHENTICATION_REQUIRED';
}
