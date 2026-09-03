import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  assertContractLock,
  assertNoHbbtznSubdomain,
  validateDomainContract,
  validateEdgeRedirects,
  validateIdentityEnvironmentText,
} from './domain-boundary.mjs';

const root = resolve(import.meta.dirname, '../..');
const contractSource = readFileSync(resolve(root, 'config/production-domain-boundary.json'), 'utf8');
const contract = JSON.parse(contractSource);
const lock = JSON.parse(readFileSync(resolve(root, 'config/production-domain-boundary.lock.json'), 'utf8'));

test('accepts the owner-approved production domain contract and lock', () => {
  assert.doesNotThrow(() => assertContractLock(contractSource, lock));
  assert.equal(validateDomainContract(contract), contract);
  assert.throws(
    () => assertContractLock(contractSource.replace('api.zhudatuan.com', 'api.hbbtzn.com'), lock),
    /PRODUCTION_DOMAIN_OWNER_APPROVAL_REQUIRED/,
  );
});

test('rejects every hbbtzn hostname in active runtime code', () => {
  assert.throws(
    () => assertNoHbbtznSubdomain('h5.ts', "const origin = 'https://hbbtzn.com'"),
    /HBBTZN_SUBDOMAIN_RUNTIME_FORBIDDEN:h5\.ts:hbbtzn\.com/,
  );
  assert.throws(
    () => assertNoHbbtznSubdomain('identity.ts', "const api = 'https://api.hbbtzn.com'"),
    /HBBTZN_SUBDOMAIN_RUNTIME_FORBIDDEN:identity\.ts:api\.hbbtzn\.com/,
  );
});

test('rejects production identity environment pollution', () => {
  const valid = [
    `API_ALLOWED_ORIGINS=${contract.identityApi.allowedOrigins.join(',')}`,
    `AUTH_RETURN_TARGETS='${JSON.stringify(contract.identityApi.returnTargets)}'`,
  ].join('\n');
  assert.doesNotThrow(() => validateIdentityEnvironmentText(valid, contract));
  assert.throws(
    () => validateIdentityEnvironmentText(valid.replace(
      '"storefront":"https://zhudatuan.com"',
      '"storefront":"https://mall.hbbtzn.com"',
    ), contract),
    /PRODUCTION_DOMAIN_ENV_RETURN_TARGETS_DRIFT/,
  );
  assert.throws(
    () => validateIdentityEnvironmentText(valid.replace('https://accounts.zhudatuan.com', 'https://accounts.hbbtzn.com'), contract),
    /PRODUCTION_DOMAIN_ENV_ORIGINS_DRIFT/,
  );
});

test('keeps hbbtzn control-plane aliases redirect-only at the edge', () => {
  const source = readFileSync(resolve(root, 'infrastructure/zhudatuan/cloudflare/hbbtzn-alias/src/index.ts'), 'utf8');
  assert.doesNotThrow(() => validateEdgeRedirects(source, contract));
  assert.throws(
    () => validateEdgeRedirects(source.replace(
      "[ROOT_STOREFRONT_HOST]: 'https://zhudatuan.com'",
      "[ROOT_STOREFRONT_HOST]: 'https://zhudatuan.com',\n  'api.hbbtzn.com': 'https://api.zhudatuan.com'",
    ), contract),
    /PRODUCTION_DOMAIN_EDGE_ALIAS_PROXY_FORBIDDEN/,
  );
});
