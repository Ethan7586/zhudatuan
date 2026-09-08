import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

export const MINIAPP_DEVICE_SCENARIOS = Object.freeze([
  'safearea',
  'weaknetwork',
  'privacyauthorization',
  'login',
  'purchase',
  'paymentreturn',
  'order',
  'voucher',
  'scanredemption',
] as const);

type DeviceScenario = (typeof MINIAPP_DEVICE_SCENARIOS)[number];

interface DeviceRecord {
  readonly source: 'developertool' | 'physical';
  readonly device: string;
  readonly system: string;
  readonly wechat: string;
  readonly network: 'normal' | 'weak' | 'offline';
  readonly scenario: DeviceScenario;
  readonly passed: true;
  readonly evidenceSha256: string;
}

interface DeviceEvidence {
  readonly schema: 'shop.miniapp.device.v1';
  readonly artifactSha256: string;
  readonly capturedAt: string;
  readonly approvedAt: string;
  readonly approvedBy: string;
  readonly records: readonly DeviceRecord[];
}

const SHA256 = /^[a-f0-9]{64}$/;
const REQUIRED_PHYSICAL = new Set<DeviceScenario>(MINIAPP_DEVICE_SCENARIOS);

export function miniappArtifactHash(directory: string): string {
  const digest = createHash('sha256');
  for (const path of files(directory)) {
    digest.update(relative(directory, path).split('\\').join('/'));
    digest.update('\0');
    digest.update(readFileSync(path));
    digest.update('\0');
  }
  return digest.digest('hex');
}

export function validateDeviceEvidence(value: unknown, artifactSha256: string, now = new Date()): DeviceEvidence {
  if (!isRecord(value) || value.schema !== 'shop.miniapp.device.v1') throw new Error('MINIAPP_DEVICE_EVIDENCE_SCHEMA_INVALID');
  if (!SHA256.test(text(value.artifactSha256)) || value.artifactSha256 !== artifactSha256) throw new Error('MINIAPP_DEVICE_ARTIFACT_MISMATCH');
  const capturedAt = time(value.capturedAt, 'MINIAPP_DEVICE_CAPTURE_INVALID');
  const approvedAt = time(value.approvedAt, 'MINIAPP_DEVICE_APPROVAL_INVALID');
  if (approvedAt < capturedAt || approvedAt > now.getTime() + 300_000 || now.getTime() - capturedAt > 30 * 86_400_000) throw new Error('MINIAPP_DEVICE_EVIDENCE_EXPIRED');
  if (!/^[\p{L}\p{N} .@:-]{2,100}$/u.test(text(value.approvedBy))) throw new Error('MINIAPP_DEVICE_APPROVER_INVALID');
  if (!Array.isArray(value.records) || value.records.length < 2) throw new Error('MINIAPP_DEVICE_RECORDS_INCOMPLETE');
  const records = value.records.map(deviceRecord);
  if (!records.some(({ source }) => source === 'developertool')) throw new Error('MINIAPP_DEVELOPER_TOOL_EVIDENCE_MISSING');
  const physical = records.filter(({ source }) => source === 'physical');
  if (new Set(physical.map(({ device }) => device)).size === 0) throw new Error('MINIAPP_PHYSICAL_DEVICE_EVIDENCE_MISSING');
  for (const scenario of REQUIRED_PHYSICAL) if (!physical.some((record) => record.scenario === scenario)) throw new Error(`MINIAPP_PHYSICAL_SCENARIO_MISSING:${scenario}`);
  if (!physical.some(({ scenario, network }) => scenario === 'weaknetwork' && network === 'weak')) throw new Error('MINIAPP_WEAK_NETWORK_EVIDENCE_MISSING');
  if (!physical.some(({ network }) => network === 'offline')) throw new Error('MINIAPP_OFFLINE_EVIDENCE_MISSING');
  return Object.freeze({
    schema: 'shop.miniapp.device.v1', artifactSha256, capturedAt: text(value.capturedAt), approvedAt: text(value.approvedAt),
    approvedBy: text(value.approvedBy), records: Object.freeze(records),
  });
}

function deviceRecord(value: unknown): DeviceRecord {
  if (!isRecord(value) || !['developertool', 'physical'].includes(text(value.source))) throw new Error('MINIAPP_DEVICE_RECORD_SOURCE_INVALID');
  if (!(MINIAPP_DEVICE_SCENARIOS as readonly string[]).includes(text(value.scenario))) throw new Error('MINIAPP_DEVICE_SCENARIO_INVALID');
  if (!['normal', 'weak', 'offline'].includes(text(value.network)) || value.passed !== true || !SHA256.test(text(value.evidenceSha256))) throw new Error('MINIAPP_DEVICE_RECORD_INVALID');
  for (const field of ['device', 'system', 'wechat'] as const) if (text(value[field]).length > 100) throw new Error('MINIAPP_DEVICE_RECORD_INVALID');
  return Object.freeze({
    source: value.source as DeviceRecord['source'], device: text(value.device), system: text(value.system), wechat: text(value.wechat),
    network: value.network as DeviceRecord['network'], scenario: value.scenario as DeviceScenario, passed: true, evidenceSha256: text(value.evidenceSha256),
  });
}

function files(directory: string, output: string[] = []): readonly string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files(path, output);
    else if (entry.isFile()) output.push(path);
    else throw new Error('MINIAPP_ARTIFACT_SPECIAL_FILE_FORBIDDEN');
  }
  return output;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error('MINIAPP_DEVICE_TEXT_INVALID');
  return value.trim();
}

function time(value: unknown, code: string): number {
  const parsed = Date.parse(text(value));
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}
