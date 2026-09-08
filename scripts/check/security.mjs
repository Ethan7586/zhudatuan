#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import { repositoryRoot as root } from '../lib/RepositoryRoot.mjs';

const violations = [];
const production = ['apps', 'services', 'packages', 'extensions'].flatMap((directory) => files(join(root, directory)));
const textFiles = production.filter((file) => /\.(?:ts|tsx|js|jsx|mjs|cjs|json|ya?ml|css|html)$/.test(file));
const checks = Object.freeze([
  ['PRIVATE_KEY_EMBEDDED', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s+[A-Za-z0-9+/=]{32,}/],
  ['AWS_ACCESS_KEY_EMBEDDED', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['ALIYUN_ACCESS_KEY_EMBEDDED', /\bLTAI[A-Za-z0-9]{12,24}\b/],
  ['CREDENTIAL_IN_URL', /\b(?:postgres(?:ql)?|redis|https?):\/\/[^\s/:]+:[^\s/@]+@/i],
  ['DYNAMIC_CODE_EXECUTION', /\bnew\s+Function\s*\(|(?<![.\w])eval\s*\(/],
  ['UNSAFE_HTML_INJECTION', /dangerouslySetInnerHTML|\.innerHTML\s*=|document\.write\s*\(/],
  ['WILDCARD_POSTMESSAGE', /postMessage\s*\([^,]+,\s*['"]\*['"]\s*\)/],
  ['UNSAFE_CHILD_PROCESS', /\b(?:exec|execSync|spawn|spawnSync)\s*\([^\n]+\{[^\n]*shell\s*:\s*true/],
  ['CLIENT_SECRET_ENVIRONMENT', /\bVITE_[A-Z0-9_]*(?:SECRET|PASSWORD|PRIVATE_KEY|ACCESS_KEY|BEARER_TOKEN)\b/],
  ['PII_OR_SECRET_LOGGING', /(?:console|logger)\.(?:log|info|warn|error|debug)\s*\([^\n]*(?:password|secret|token|credential|phone|mobile|email|address)/i],
]);

for (const file of textFiles) {
  const source = readFileSync(file, 'utf8');
  for (const [code, pattern] of checks) {
    const match = pattern.exec(source);
    if (match) violation(code, file, lineOf(source, match.index));
  }
}

const edge = yaml('infrastructure/network/Edge.yml');
const cors = yaml('infrastructure/storage/Cors.yml');
const clients = yaml('config/clients.yml')?.clients?.map(({ id }) => id) ?? [];
if (edge?.cors !== 'infrastructure/storage/Cors.yml' || cors?.credentials !== true || cors?.wildcard !== false) violation('CORS_POLICY_UNSAFE', join(root, 'infrastructure/storage/Cors.yml'));
if (clients.length !== 6 || Object.keys(cors?.origins ?? {}).sort().join(',') !== [...clients].sort().join(',')) violation('CORS_SURFACE_SET_INVALID', join(root, 'infrastructure/storage/Cors.yml'));
for (const surface of clients) {
  if (cors?.origins?.[surface]?.source !== `routes.${surface}.host` || !Array.isArray(cors.origins[surface].methods) || !cors.origins[surface].methods.includes('OPTIONS')) {
    violation('CORS_SURFACE_POLICY_INVALID', join(root, 'infrastructure/storage/Cors.yml'), surface);
  }
  const csp = edge?.headers?.[surface]?.contentSecurityPolicy;
  if (!csp) {
    violation('CSP_SURFACE_MISSING', join(root, 'infrastructure/network/Edge.yml'), surface);
    continue;
  }
  const serialized = JSON.stringify(csp);
  if (serialized.includes('*') || serialized.includes('unsafe-inline') || serialized.includes('unsafe-eval')) violation('CSP_SURFACE_UNSAFE', join(root, 'infrastructure/network/Edge.yml'), surface);
  if (JSON.stringify(csp.default) !== JSON.stringify(['none']) || JSON.stringify(csp.frameAncestors) !== JSON.stringify(['none']) || JSON.stringify(csp.object) !== JSON.stringify(['none'])) {
    violation('CSP_BASELINE_INCOMPLETE', join(root, 'infrastructure/network/Edge.yml'), surface);
  }
}

const egress = yaml('infrastructure/network/Egress.yml');
const providers = yaml('config/providers.yml')?.providers?.map(({ id }) => id) ?? [];
if (egress?.default !== 'deny' || providers.length !== 11 || egress?.providers?.hosts?.map(({ id }) => id).join(',') !== providers.join(',')) violation('EGRESS_PROVIDER_SET_INVALID', join(root, 'infrastructure/network/Egress.yml'));
if (['wechatpay', 'wechatnotification', 'sms', 'email'].some((id) => !egress?.services?.some((service) => service.id === id))) violation('EGRESS_SERVICE_SET_INVALID', join(root, 'infrastructure/network/Egress.yml'));
const networkPolicy = readFileSync(join(root, 'infrastructure/network/Policy.yml'), 'utf8');
if (!networkPolicy.includes('shop-default-deny') || !networkPolicy.includes('shop-provider-egress') || /0\.0\.0\.0\/0/.test(networkPolicy)) violation('NETWORK_POLICY_EGRESS_UNSAFE', join(root, 'infrastructure/network/Policy.yml'));
const storage = yaml('infrastructure/storage/Policy.yml');
for (const kind of ['import', 'export', 'credential', 'support', 'experience', 'evidence']) if (!storage?.classes?.[kind]) violation('STORAGE_CLASS_MISSING', join(root, 'infrastructure/storage/Policy.yml'), kind);
if (storage?.access?.default !== 'deny' || storage?.access?.publicAcl !== 'forbidden' || storage?.scan?.failMode !== 'closed') violation('STORAGE_POLICY_UNSAFE', join(root, 'infrastructure/storage/Policy.yml'));

const secrets = yaml('infrastructure/security/Secrets.yml');
if (secrets?.valuesInRepository !== 'forbidden' || !Array.isArray(secrets?.catalog) || secrets.catalog.length < 19 || secrets.catalog.some((item) => !item.id || !item.owner || !item.purpose || !Array.isArray(item.readers) || !item.revoke)) {
  violation('SECRET_CATALOG_INCOMPLETE', join(root, 'infrastructure/security/Secrets.yml'));
}
const data = yaml('infrastructure/security/Data.yml');
if (Object.keys(data?.classification ?? {}).join(',') !== 'public,internal,sensitive,restricted' || data?.logs?.sanitizer !== 'before-buffer-and-export' || data?.controls?.plaintextCache !== 'forbidden') {
  violation('DATA_SECURITY_POLICY_INCOMPLETE', join(root, 'infrastructure/security/Data.yml'));
}
const browser = yaml('infrastructure/security/Browser.yml');
if (browser?.surfaces?.join(',') !== clients.join(',') || browser?.session?.cookie?.sameSite !== 'Strict' || browser?.csrf?.origin !== 'exact-allowlist' || browser?.dom?.eval !== 'forbidden') {
  violation('BROWSER_SECURITY_POLICY_INCOMPLETE', join(root, 'infrastructure/security/Browser.yml'));
}
const database = yaml('infrastructure/security/Database.yml');
if (database?.rls?.required !== 'all-tenant-tables' || database?.rls?.force !== true || database?.roles?.migration?.concurrentSessions !== 1 || database?.migration?.phases?.join(',') !== 'prepare,backfill,assert,cutover,retire') {
  violation('DATABASE_SECURITY_POLICY_INCOMPLETE', join(root, 'infrastructure/security/Database.yml'));
}
const extensions = yaml('infrastructure/security/Extensions.yml');
if (extensions?.package?.signature !== 'ed25519' || extensions?.runtime?.process !== 'provider' || extensions?.runtime?.apiProcessLoad !== 'forbidden' || extensions?.sandbox?.contractSuite?.join(',') !== 'Contract,Fixture,Mapping,Failure') {
  violation('EXTENSION_SECURITY_POLICY_INCOMPLETE', join(root, 'infrastructure/security/Extensions.yml'));
}
const identityProviders = yaml('config/identityproviders.yml');
if (identityProviders?.security?.pkce !== 'S256' || identityProviders?.security?.bindingConflict !== 'reject' || identityProviders?.security?.issuerPolicy !== 'exact-configured-https-origin' || identityProviders?.security?.redirectMatch !== 'exact-origin-and-path') {
  violation('IDENTITY_PROVIDER_SECURITY_INCOMPLETE', join(root, 'config/identityproviders.yml'));
}

const operations = yaml('packages/contract/definitions/operations.yml')?.operations ?? [];
for (const operation of operations) {
  const location = join(root, 'packages/contract/definitions/operations.yml');
  if (!operation.id || !operation.owner || !operation.audience || !operation.assuranceLevel || !operation.originPolicy || !operation.csrfPolicy || !operation.risk) {
    violation('OPERATION_SECURITY_POLICY_INCOMPLETE', location, operation.id ?? 'unknown');
  }
  const handlerMode = operation.handler ? declaredHandlerMode(operation.handler) : null;
  if (operation.method !== 'GET' && operation.method !== 'HEAD' && operation.audience !== 'system' && operation.audience !== 'provider' && operation.idempotencyPolicy === 'none' && handlerMode !== 'read') {
    violation('WRITE_IDEMPOTENCY_POLICY_MISSING', location, operation.id);
  }
  if (operation.risk === 'critical' && !['mfa', 'stepup'].includes(operation.assuranceLevel)) violation('CRITICAL_OPERATION_ASSURANCE_INSUFFICIENT', location, operation.id);
  if (operation.makerChecker === true && operation.assuranceLevel !== 'stepup') violation('MAKER_CHECKER_WITHOUT_STEPUP', location, operation.id);
}

const objects = yaml('database/contracts/objects.yml')?.objects ?? [];
for (const object of objects.filter(({ kind }) => kind === 'table')) {
  if (object.rls !== true) violation('TABLE_WITHOUT_RLS', join(root, 'database/contracts/objects.yml'), object.id);
  if (typeof object.owner !== 'string' || !/^shop[a-z]+owner$/.test(object.owner)) violation('TABLE_OWNER_INVALID', join(root, 'database/contracts/objects.yml'), object.id);
}

const migrationText = files(join(root, 'database/migrations')).filter((file) => file.endsWith('.sql')).map((file) => readFileSync(file, 'utf8')).join('\n');
for (const proof of ['force row level security', 'nobypassrls', 'revoke all', 'consume_action_proof', 'assert_role_separation']) {
  if (!migrationText.toLowerCase().includes(proof)) violation('DATABASE_SECURITY_PROOF_MISSING', join(root, 'database/migrations'), proof);
}

if (violations.length) {
  process.stderr.write(`security gate rejected: ${violations.length}\n`);
  for (const item of violations) process.stderr.write(`${item.code}:${item.path}${item.detail ? `:${item.detail}` : ''}\n`);
  process.exit(1);
}
process.stdout.write(`security gate accepted: sources=${textFiles.length} operations=${operations.length} rlsTables=${objects.filter(({ kind }) => kind === 'table').length} cspSurfaces=${clients.length} providers=${providers.length}\n`);

function files(directory, result = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignored(entry.name)) continue;
    const target = join(directory, entry.name);
    if (entry.isDirectory()) files(target, result);
    else if (entry.isFile() && !/\.(?:test|spec)\./.test(entry.name)) result.push(target);
  }
  return result;
}

function ignored(name) {
  return ['node_modules', 'dist', 'coverage', '.next', '.open-next', 'test', 'tests', '__tests__', 'fixtures', 'scripts'].includes(name);
}

function yaml(path) {
  return parse(readFileSync(join(root, path), 'utf8'), { merge: true });
}

function declaredHandlerMode(path) {
  const source = readFileSync(join(root, path), 'utf8');
  return /readonly mode = ['"](read|write)['"]/.exec(source)?.[1]
    ?? /OperationHandler<[^>]+,\s*['"](read|write)['"]/.exec(source)?.[1]
    ?? /PreparedOperation<[^>]+,\s*[^,>]+,\s*['"](read|write)['"]/.exec(source)?.[1]
    ?? /DurableOperationHandler<[^>]+,\s*[^,>]+,\s*[^,>]+,\s*['"](read|write)['"]/.exec(source)?.[1]
    ?? null;
}

function lineOf(source, offset) {
  return String(source.slice(0, offset).split('\n').length);
}

function violation(code, path, detail = '') {
  violations.push({ code, path: relative(root, path), detail });
}
