import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

const HOUR = 60 * 60 * 1_000;
const MAX_QUOTE_AGE = 24 * HOUR;
const MAX_QUOTE_LIFETIME = 7 * 24 * HOUR;
const HASH = /^[a-f0-9]{64}$/u;

const schema = Object.freeze({
  version: null,
  state: null,
  quotedAt: null,
  quoteExpiresAt: null,
  region: null,
  currency: null,
  validationWindowHours: null,
  monthlyEstimateHours: null,
  quoteEvidenceSha256: null,
  ecs: {
    configurationFingerprint: null,
    hourlyComputeAndDiskCny: null,
    estimated72HourCny: null,
    estimated730HourCny: null,
    publicTrafficUnitCnyPerGb: null,
    acceptancePublicTrafficCapGb: null,
    acceptancePublicTrafficCapCny: null,
  },
  rds: {
    configurationFingerprint: null,
    hourlyComputeAndStorageCny: null,
    estimated72HourCny: null,
    estimated730HourCny: null,
    optional72HourServiceCny: null,
    optional730HourServiceCny: null,
  },
  tair: {
    configurationFingerprint: null,
    hourlyInstanceCny: null,
    estimated72HourCny: null,
    estimated730HourCny: null,
    optional72HourServiceCny: null,
    optional730HourServiceCny: null,
  },
  sms: {
    verificationMessageUnitCny: null,
    acceptanceMessageCap: null,
    acceptanceMessageCapCny: null,
  },
  totals: {
    estimated72HourCny: null,
    estimated730HourCny: null,
    hardApprovalCapCny: null,
  },
  approval: {
    approvedBy: null,
    approvedAt: null,
    decision: null,
    specificationSha256: null,
    externalApprovalReceiptSha256: null,
  },
});

export function validateCostApproval(value, now = new Date()) {
  exactShape(value, schema, 'costApproval');
  if (value.version !== 1 || value.state !== 'approved-user-cost-cap' || value.region !== 'cn-beijing'
    || value.currency !== 'CNY' || value.validationWindowHours !== 72 || value.monthlyEstimateHours !== 730) {
    fail('COST_APPROVAL_BOUNDARY_INVALID');
  }
  for (const hash of [value.quoteEvidenceSha256, value.ecs.configurationFingerprint,
    value.rds.configurationFingerprint, value.tair.configurationFingerprint,
    value.approval.specificationSha256, value.approval.externalApprovalReceiptSha256]) {
    if (typeof hash !== 'string' || !HASH.test(hash)) fail('COST_APPROVAL_EVIDENCE_INVALID');
  }

  const nowTime = now.getTime();
  const quotedAt = timestamp(value.quotedAt, 'COST_QUOTED_AT_INVALID');
  const expiresAt = timestamp(value.quoteExpiresAt, 'COST_QUOTE_EXPIRY_INVALID');
  const approvedAt = timestamp(value.approval.approvedAt, 'COST_APPROVED_AT_INVALID');
  if (quotedAt > approvedAt || approvedAt > nowTime + 5 * 60_000 || nowTime - quotedAt > MAX_QUOTE_AGE
    || expiresAt <= nowTime || expiresAt <= quotedAt || expiresAt - quotedAt > MAX_QUOTE_LIFETIME) {
    fail('COST_APPROVAL_TIME_WINDOW_INVALID');
  }
  if (value.approval.approvedBy !== 'Ethan' || value.approval.decision !== 'approved') {
    fail('COST_APPROVAL_DECISION_INVALID');
  }

  rate(value.ecs.hourlyComputeAndDiskCny, 'COST_ECS_RATE_INVALID');
  rate(value.ecs.publicTrafficUnitCnyPerGb, 'COST_TRAFFIC_RATE_INVALID');
  positiveInteger(value.ecs.acceptancePublicTrafficCapGb, 'COST_TRAFFIC_CAP_INVALID');
  money(value.ecs.estimated72HourCny, 'COST_ECS_72_INVALID');
  money(value.ecs.estimated730HourCny, 'COST_ECS_730_INVALID');
  money(value.ecs.acceptancePublicTrafficCapCny, 'COST_TRAFFIC_COST_INVALID');
  equalMoney(value.ecs.estimated72HourCny, value.ecs.hourlyComputeAndDiskCny * 72, 'COST_ECS_72_MISMATCH');
  equalMoney(value.ecs.estimated730HourCny, value.ecs.hourlyComputeAndDiskCny * 730, 'COST_ECS_730_MISMATCH');
  equalMoney(value.ecs.acceptancePublicTrafficCapCny,
    value.ecs.publicTrafficUnitCnyPerGb * value.ecs.acceptancePublicTrafficCapGb, 'COST_TRAFFIC_CAP_MISMATCH');

  validateManagedResource(value.rds, 'hourlyComputeAndStorageCny', 'RDS');
  validateManagedResource(value.tair, 'hourlyInstanceCny', 'TAIR');
  rate(value.sms.verificationMessageUnitCny, 'COST_SMS_RATE_INVALID');
  positiveInteger(value.sms.acceptanceMessageCap, 'COST_SMS_CAP_INVALID');
  money(value.sms.acceptanceMessageCapCny, 'COST_SMS_COST_INVALID');
  equalMoney(value.sms.acceptanceMessageCapCny,
    value.sms.verificationMessageUnitCny * value.sms.acceptanceMessageCap, 'COST_SMS_CAP_MISMATCH');

  const expected72 = value.ecs.estimated72HourCny + value.ecs.acceptancePublicTrafficCapCny
    + value.rds.estimated72HourCny + value.rds.optional72HourServiceCny
    + value.tair.estimated72HourCny + value.tair.optional72HourServiceCny
    + value.sms.acceptanceMessageCapCny;
  const expected730 = value.ecs.estimated730HourCny + value.ecs.acceptancePublicTrafficCapCny
    + value.rds.estimated730HourCny + value.rds.optional730HourServiceCny
    + value.tair.estimated730HourCny + value.tair.optional730HourServiceCny
    + value.sms.acceptanceMessageCapCny;
  money(value.totals.estimated72HourCny, 'COST_TOTAL_72_INVALID');
  money(value.totals.estimated730HourCny, 'COST_TOTAL_730_INVALID');
  money(value.totals.hardApprovalCapCny, 'COST_HARD_CAP_INVALID');
  equalMoney(value.totals.estimated72HourCny, expected72, 'COST_TOTAL_72_MISMATCH');
  equalMoney(value.totals.estimated730HourCny, expected730, 'COST_TOTAL_730_MISMATCH');
  if (cents(value.totals.hardApprovalCapCny) < cents(value.totals.estimated72HourCny)) {
    fail('COST_HARD_CAP_BELOW_72_HOUR_ESTIMATE');
  }

  const costEstimateSha256 = digest(canonical(value));
  return Object.freeze({
    schema: 'zhudatuan.staging.cost-approval.v1',
    region: value.region,
    quotedAt: value.quotedAt,
    quoteExpiresAt: value.quoteExpiresAt,
    approvedAt: value.approval.approvedAt,
    approvedBy: value.approval.approvedBy,
    specificationSha256: value.approval.specificationSha256,
    externalApprovalReceiptSha256: value.approval.externalApprovalReceiptSha256,
    estimated72HourCny: value.totals.estimated72HourCny,
    hardApprovalCapCny: value.totals.hardApprovalCapCny,
    costEstimateSha256,
  });
}

export function validateCostEvidenceBytes(value, evidence) {
  exactShape(evidence, { quote: null, specification: null, approvalReceipt: null }, 'costEvidence');
  if (!Object.values(evidence).every((bytes) => Buffer.isBuffer(bytes) && bytes.byteLength > 0)) {
    fail('COST_EXTERNAL_EVIDENCE_EMPTY');
  }
  const hashes = {
    quote: digest(evidence.quote),
    specification: digest(evidence.specification),
    approvalReceipt: digest(evidence.approvalReceipt),
  };
  if (new Set(Object.values(hashes)).size !== 3
    || hashes.quote !== value.quoteEvidenceSha256
    || hashes.specification !== value.approval.specificationSha256
    || hashes.approvalReceipt !== value.approval.externalApprovalReceiptSha256) {
    fail('COST_EXTERNAL_EVIDENCE_DIGEST_MISMATCH');
  }
  return Object.freeze(hashes);
}

function validateManagedResource(value, rateKey, label) {
  rate(value[rateKey], `COST_${label}_RATE_INVALID`);
  for (const key of ['estimated72HourCny', 'estimated730HourCny', 'optional72HourServiceCny', 'optional730HourServiceCny']) {
    money(value[key], `COST_${label}_${key.toUpperCase()}_INVALID`, key.startsWith('optional'));
  }
  equalMoney(value.estimated72HourCny, value[rateKey] * 72, `COST_${label}_72_MISMATCH`);
  equalMoney(value.estimated730HourCny, value[rateKey] * 730, `COST_${label}_730_MISMATCH`);
}

function exactShape(value, expected, path) {
  if (!record(value) || Object.keys(value).sort().join('\0') !== Object.keys(expected).sort().join('\0')) {
    fail(`COST_APPROVAL_SCHEMA_INVALID:${path}`);
  }
  for (const [key, child] of Object.entries(expected)) {
    if (child !== null) exactShape(value[key], child, `${path}.${key}`);
  }
}

function rate(value, code) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1_000_000
    || Math.abs(value * 1_000_000 - Math.round(value * 1_000_000)) > 1e-6) fail(code);
}

function positiveInteger(value, code) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 1_000_000) fail(code);
}

function money(value, code, allowZero = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < (allowZero ? 0 : 0.01)
    || value > 1_000_000_000 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-7) fail(code);
}

function equalMoney(actual, expected, code) {
  if (cents(actual) !== cents(expected)) fail(code);
}

function cents(value) {
  return Math.round(value * 100);
}

function timestamp(value, code) {
  const time = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) fail(code);
  return time;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (record(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fail(code) {
  throw new Error(code);
}

async function loadApproval(path) {
  const resolved = resolve(path);
  const information = await lstat(resolved);
  if (!information.isFile() || information.isSymbolicLink() || information.size > 64 * 1024
    || (information.mode & 0o022) !== 0) fail('COST_APPROVAL_FILE_BOUNDARY_INVALID');
  const document = parseDocument(await readFile(resolved, 'utf8'), { uniqueKeys: true });
  if (document.errors.length > 0 || document.warnings.length > 0) fail('COST_APPROVAL_YAML_INVALID');
  return document.toJS({ maxAliasCount: 0 });
}

async function loadExternalEvidence(paths) {
  const resolved = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, resolve(path)]));
  if (new Set(Object.values(resolved)).size !== 3) fail('COST_EXTERNAL_EVIDENCE_PATH_REUSE');
  return Object.fromEntries(await Promise.all(Object.entries(resolved).map(async ([key, path]) => {
    const information = await lstat(path);
    if (!information.isFile() || information.isSymbolicLink() || information.size < 1 || information.size > 8 * 1024 * 1024
      || (information.mode & 0o022) !== 0) fail(`COST_EXTERNAL_EVIDENCE_FILE_INVALID:${key}`);
    return [key, await readFile(path)];
  })));
}

function approvedFixture(now = new Date()) {
  const quotedAt = new Date(now.getTime() - HOUR).toISOString();
  const approvedAt = new Date(now.getTime() - 30 * 60_000).toISOString();
  const quoteExpiresAt = new Date(now.getTime() + 6 * HOUR).toISOString();
  return {
    version: 1, state: 'approved-user-cost-cap', quotedAt, quoteExpiresAt, region: 'cn-beijing', currency: 'CNY',
    validationWindowHours: 72, monthlyEstimateHours: 730, quoteEvidenceSha256: digest('redacted-beijing-quote'),
    ecs: { configurationFingerprint: '2'.repeat(64), hourlyComputeAndDiskCny: 0.5, estimated72HourCny: 36,
      estimated730HourCny: 365, publicTrafficUnitCnyPerGb: 0.8, acceptancePublicTrafficCapGb: 10,
      acceptancePublicTrafficCapCny: 8 },
    rds: { configurationFingerprint: '3'.repeat(64), hourlyComputeAndStorageCny: 1, estimated72HourCny: 72,
      estimated730HourCny: 730, optional72HourServiceCny: 0, optional730HourServiceCny: 0 },
    tair: { configurationFingerprint: '4'.repeat(64), hourlyInstanceCny: 0.25, estimated72HourCny: 18,
      estimated730HourCny: 182.5, optional72HourServiceCny: 0, optional730HourServiceCny: 0 },
    sms: { verificationMessageUnitCny: 0.045, acceptanceMessageCap: 10, acceptanceMessageCapCny: 0.45 },
    totals: { estimated72HourCny: 134.45, estimated730HourCny: 1285.95, hardApprovalCapCny: 140 },
    approval: { approvedBy: 'Ethan', approvedAt, decision: 'approved', specificationSha256: digest('approved-specification'),
      externalApprovalReceiptSha256: digest('independent-ethan-approval') },
  };
}

function selfTest() {
  const now = new Date('2026-08-29T10:00:00.000Z');
  const fixture = approvedFixture(now);
  assert.match(validateCostApproval(fixture, now).costEstimateSha256, HASH);
  assert.deepEqual(validateCostEvidenceBytes(fixture, {
    quote: Buffer.from('redacted-beijing-quote'),
    specification: Buffer.from('approved-specification'),
    approvalReceipt: Buffer.from('independent-ethan-approval'),
  }), {
    quote: fixture.quoteEvidenceSha256,
    specification: fixture.approval.specificationSha256,
    approvalReceipt: fixture.approval.externalApprovalReceiptSha256,
  });
  assert.throws(() => validateCostEvidenceBytes(fixture, {
    quote: Buffer.from('tampered-quote'),
    specification: Buffer.from('approved-specification'),
    approvalReceipt: Buffer.from('independent-ethan-approval'),
  }), /COST_EXTERNAL_EVIDENCE_DIGEST_MISMATCH/u);
  assert.throws(() => validateCostApproval({ ...fixture, totals: { ...fixture.totals, estimated72HourCny: 134.46 } }, now),
    /COST_TOTAL_72_MISMATCH/u);
  assert.throws(() => validateCostApproval({ ...fixture, quoteExpiresAt: '2026-08-29T09:59:59.000Z' }, now),
    /COST_APPROVAL_TIME_WINDOW_INVALID/u);
  assert.throws(() => validateCostApproval({ ...fixture, unexpected: true }, now), /COST_APPROVAL_SCHEMA_INVALID/u);
  assert.throws(() => validateCostApproval({ ...fixture, state: 'pending-user-approval' }, now), /COST_APPROVAL_BOUNDARY_INVALID/u);
  assert.throws(() => validateCostApproval({ ...fixture, quotedAt: '2026-08-27T10:00:00.000Z' }, now),
    /COST_APPROVAL_TIME_WINDOW_INVALID/u);
  process.stdout.write('Cost approval validator self-test passed.\n');
}

if (resolve(argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    if (argv.length === 3 && argv[2] === '--self-test') selfTest();
    else if (argv.length === 10 && argv[2] === '--file' && argv[4] === '--quote-evidence'
      && argv[6] === '--specification' && argv[8] === '--approval-receipt') {
      const approval = await loadApproval(argv[3]);
      validateCostEvidenceBytes(approval, await loadExternalEvidence({
        quote: argv[5], specification: argv[7], approvalReceipt: argv[9],
      }));
      process.stdout.write(`${JSON.stringify(validateCostApproval(approval), null, 2)}\n`);
    } else fail('USAGE: validate-cost-approval.mjs --file <approved-yaml> --quote-evidence <redacted-quote-file> --specification <spec-file> --approval-receipt <receipt-file> | --self-test');
  } catch (cause) {
    process.stderr.write(`${cause instanceof Error ? cause.message : String(cause)}\n`);
    process.exitCode = 1;
  }
}
