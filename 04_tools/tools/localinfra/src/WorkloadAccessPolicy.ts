import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { LocalHttpError } from './Http';

const TOKEN = /^[A-Za-z0-9_-]{43,512}$/;
const WORKLOAD = /^[a-z][a-z0-9-]{2,63}$/;
const RESOURCE = /^[a-z0-9][a-z0-9/.-]{2,255}$/;

export type FullStagingAccessPhase = 'bootstrap' | 'runtime';

export interface WorkloadResourceAuthorization {
  authenticate(headers: Readonly<Record<string, string>>): string;
  require(workload: string, resource: string): void;
}

interface ParsedGrant {
  readonly workload: string;
  readonly bearerDigest: Buffer;
  readonly resources: ReadonlySet<string>;
}

export interface WorkloadAccessPolicy {
  readonly phase: FullStagingAccessPhase;
  readonly kms: WorkloadResourceAuthorization;
  readonly secretStore: WorkloadResourceAuthorization;
  assertTokenNotReused(token: string): void;
}

const FULL_STAGING_BOUNDARY = Object.freeze({
  bootstrap: Object.freeze({
    secretStore: Object.freeze({
      migration: Object.freeze(['zhudatuan/staging/full/database/migration']),
      'owner-bootstrap': Object.freeze([
        'zhudatuan/staging/full/identity/index',
        'zhudatuan/staging/full/registration/owner/bootstrap-receipt',
        'zhudatuan/staging/full/registration/owner/password',
      ]),
    }),
    kms: Object.freeze({
      migration: Object.freeze(['channel/distributor', 'identity/wechat', 'partner/address', 'voucher/code']),
    }),
  }),
  runtime: Object.freeze({
    secretStore: Object.freeze({
      'full-jobs': Object.freeze([
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
      'identity-notification-jobs': Object.freeze([
        'zhudatuan/staging/full/database/identity-notification-jobs',
        'zhudatuan/staging/full/notification/identity-sms',
      ]),
      'identity-registration-api': Object.freeze([
        'zhudatuan/staging/full/database/identity-api',
        'zhudatuan/staging/full/identity/index',
        'zhudatuan/staging/full/identity/session',
      ]),
    }),
    kms: Object.freeze({
      'full-jobs': Object.freeze([
        'audit/archive',
        'identity/challenge',
        'identity/destination',
        'notification/recipient',
        'pii/invoice',
        'voucher/code',
      ]),
      'identity-notification-jobs': Object.freeze(['identity/challenge', 'identity/destination', 'identity/mobile']),
      'identity-registration-api': Object.freeze(['identity/challenge', 'identity/destination', 'identity/mobile']),
    }),
  }),
} satisfies Readonly<Record<FullStagingAccessPhase, Readonly<Record<'kms' | 'secretStore', Readonly<Record<string, readonly string[]>>>>>>);

export async function loadFullStagingWorkloadAccessPolicy(file: string): Promise<WorkloadAccessPolicy> {
  if (file !== '/run/credentials/zhudatuan-staging-full-internal-runtime.service/workload-access-policy') {
    throw new Error('FULL_STAGING_WORKLOAD_ACCESS_POLICY_FILE_INVALID');
  }
  let source: unknown;
  try { source = JSON.parse(await readFile(file, 'utf8')); }
  catch { throw new Error('FULL_STAGING_WORKLOAD_ACCESS_POLICY_INVALID'); }
  return parseFullStagingWorkloadAccessPolicy(source);
}

export function parseFullStagingWorkloadAccessPolicy(source: unknown): WorkloadAccessPolicy {
  const document = record(source, 'FULL_STAGING_WORKLOAD_ACCESS_POLICY_INVALID');
  exactKeys(document, ['kms', 'phase', 'secretStore', 'version'], 'FULL_STAGING_WORKLOAD_ACCESS_POLICY_INVALID');
  if (document.version !== 1 || (document.phase !== 'bootstrap' && document.phase !== 'runtime')) {
    throw new Error('FULL_STAGING_WORKLOAD_ACCESS_POLICY_INVALID');
  }
  const phase = document.phase;
  const seenDigests = new Set<string>();
  const secretStore = grants(document.secretStore, FULL_STAGING_BOUNDARY[phase].secretStore, seenDigests);
  const kms = grants(document.kms, FULL_STAGING_BOUNDARY[phase].kms, seenDigests);
  const digests = Object.freeze([...secretStore, ...kms].map(({ bearerDigest }) => bearerDigest));
  return Object.freeze({
    phase,
    secretStore: new ExactResourceAuthorization(secretStore),
    kms: new ExactResourceAuthorization(kms),
    assertTokenNotReused(token: string): void {
      const digest = tokenDigest(token);
      let reused = false;
      for (const candidate of digests) reused = timingSafeEqual(digest, candidate) || reused;
      if (reused) throw new Error('FULL_STAGING_WORKLOAD_TOKEN_REUSED');
    },
  });
}

export function unrestrictedBearerAuthorization(token: string): WorkloadResourceAuthorization {
  if (!TOKEN.test(token)) throw new Error('WORKLOAD_BEARER_TOKEN_INVALID');
  return new ExactResourceAuthorization([{ workload: 'legacy-workload', bearerDigest: tokenDigest(token), resources: null }]);
}

export function workloadAuthorizationPreflight(authorization: WorkloadResourceAuthorization) {
  return (request: Readonly<{ headers: Readonly<Record<string, string>>; url: URL }>): void => {
    if (request.url.pathname !== '/health/ready') authorization.authenticate(request.headers);
  };
}

class ExactResourceAuthorization implements WorkloadResourceAuthorization {
  constructor(private readonly grants: readonly (Omit<ParsedGrant, 'resources'> & { readonly resources: ReadonlySet<string> | null })[]) {}

  authenticate(headers: Readonly<Record<string, string>>): string {
    const authorization = headers.authorization;
    const actual = authorization?.slice(0, 7).toLowerCase() === 'bearer ' ? authorization.slice(7) : undefined;
    const digest = tokenDigest(actual ?? '');
    let match = -1;
    for (let index = 0; index < this.grants.length; index += 1) {
      if (timingSafeEqual(digest, this.grants[index]!.bearerDigest)) match = index;
    }
    if (actual === undefined || match < 0) throw new LocalHttpError(401, 'WORKLOAD_AUTHENTICATION_REQUIRED');
    return this.grants[match]!.workload;
  }

  require(workload: string, resource: string): void {
    const grant = this.grants.find((candidate) => candidate.workload === workload);
    if (!grant || (grant.resources !== null && !grant.resources.has(resource))) {
      throw new LocalHttpError(403, 'WORKLOAD_AUTHORIZATION_DENIED');
    }
  }
}

function grants(
  source: unknown,
  expected: Readonly<Record<string, readonly string[]>>,
  seenDigests: Set<string>,
): readonly ParsedGrant[] {
  const value = record(source, 'FULL_STAGING_WORKLOAD_ACCESS_POLICY_INVALID');
  const expectedWorkloads = Object.keys(expected).sort();
  if (!same(Object.keys(value).sort(), expectedWorkloads)) throw new Error('FULL_STAGING_WORKLOAD_ACCESS_POLICY_BOUNDARY_INVALID');
  return Object.freeze(expectedWorkloads.map((workload) => {
    if (!WORKLOAD.test(workload)) throw new Error('FULL_STAGING_WORKLOAD_ACCESS_POLICY_INVALID');
    const grant = record(value[workload], 'FULL_STAGING_WORKLOAD_ACCESS_POLICY_INVALID');
    exactKeys(grant, ['bearerToken', 'resources'], 'FULL_STAGING_WORKLOAD_ACCESS_POLICY_INVALID');
    if (typeof grant.bearerToken !== 'string' || !TOKEN.test(grant.bearerToken)) {
      throw new Error('FULL_STAGING_WORKLOAD_ACCESS_POLICY_TOKEN_INVALID');
    }
    const digest = tokenDigest(grant.bearerToken);
    const fingerprint = digest.toString('hex');
    if (seenDigests.has(fingerprint)) throw new Error('FULL_STAGING_WORKLOAD_ACCESS_POLICY_TOKEN_REUSED');
    seenDigests.add(fingerprint);
    if (!Array.isArray(grant.resources) || grant.resources.length === 0
      || grant.resources.some((resource) => typeof resource !== 'string' || !RESOURCE.test(resource))) {
      throw new Error('FULL_STAGING_WORKLOAD_ACCESS_POLICY_RESOURCE_INVALID');
    }
    const resources = [...new Set(grant.resources as string[])].sort();
    if (resources.length !== grant.resources.length || !same(resources, [...expected[workload]!].sort())) {
      throw new Error('FULL_STAGING_WORKLOAD_ACCESS_POLICY_BOUNDARY_INVALID');
    }
    return Object.freeze({ workload, bearerDigest: digest, resources: new Set(resources) });
  }));
}

function tokenDigest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function exactKeys(value: Readonly<Record<string, unknown>>, expected: readonly string[], code: string): void {
  if (!same(Object.keys(value).sort(), [...expected].sort())) throw new Error(code);
}

function same(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
