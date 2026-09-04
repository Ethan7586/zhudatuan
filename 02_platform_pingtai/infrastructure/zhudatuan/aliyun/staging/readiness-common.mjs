import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { request as httpsRequest } from 'node:https';
import { promisify } from 'node:util';

export const FULL_ROOT = '/opt/zhudatuan-staging-full';
export const KNOWN_PRODUCTION_PUBLIC_ADDRESS_SHA256 = '6187228d8ecf99365c59e377ff57ca5a44985b344d8c117a5d00fcb399c74ef3';
export const execute = promisify(execFile);

export function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function valueAt(source, path) {
  return path.split('.').reduce((current, part) => (record(current) ? current[part] : undefined), source);
}

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (!record(value)) return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

export function sameStrings(left, right) {
  return canonical([...left].sort()) === canonical([...right].sort());
}

export function parseEnvironment(source) {
  return Object.fromEntries(source.split(/\r?\n/u).flatMap((line) => {
    const candidate = line.trim();
    if (!candidate || candidate.startsWith('#')) return [];
    const separator = candidate.indexOf('=');
    if (separator < 1) throw new Error('ENVIRONMENT_INVALID');
    let value = candidate.slice(separator + 1);
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) value = value.slice(1, -1);
    return [[candidate.slice(0, separator), value]];
  }));
}

function placeholder(value) {
  return typeof value === 'string' && /(?:REPLACE_|replace-with|accounts\.full\.staging\.example\.invalid|console\.full\.staging\.example\.invalid|api\.full\.staging\.example\.invalid)/u.test(value);
}

export function fixedValuesMatch(actual, example) {
  return Object.entries(example).every(([key, value]) => placeholder(value) || actual[key] === value);
}

export function containsPlaceholder(value) {
  if (Array.isArray(value)) return value.some(containsPlaceholder);
  if (record(value)) return Object.values(value).some(containsPlaceholder);
  return typeof value === 'string' && placeholder(value);
}

export function bearer(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43,512}$/u.test(value);
}

export function base64Url32(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/u.test(value) && Buffer.from(value, 'base64url').byteLength === 32;
}

export function redactPolicyTokens(value) {
  if (Array.isArray(value)) return value.map(redactPolicyTokens);
  if (!record(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === 'bearerToken' ? '<redacted>'
    : key === 'resources' && Array.isArray(item) ? [...item].sort() : redactPolicyTokens(item)]));
}

export function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function digestFile(file) {
  return new Promise((resolveDigest, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.once('error', reject);
    stream.once('end', () => resolveDigest(hash.digest('hex')));
  });
}

export function matchEvidence(evidence, path, actual, missing, observed) {
  observed?.set(path, actual);
  if (valueAt(evidence, path) !== actual) missing.push(`live:${path}:mismatch`);
}

export async function matchFileFingerprint(evidence, path, file, missing, observed) {
  try { matchEvidence(evidence, path, digest(await readFile(file)), missing, observed); }
  catch { missing.push(`live:${path}:unreadable`); }
}

export function publicStagingHost(value) {
  return typeof value === 'string' && value.length <= 253 && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u.test(value)
    && value.includes('.') && /(?:^|\.)staging(?:\.|$)/u.test(value)
    && !['accounts.zhudatuan.com', 'console.zhudatuan.com', 'api.zhudatuan.com'].includes(value);
}

export async function systemdState(service) {
  const output = (await execute('/usr/bin/systemctl', ['show', service, '--no-pager',
    '--property=LoadState', '--property=ActiveState', '--property=SubState', '--property=Result',
    '--property=UnitFileState'])).stdout;
  const state = Object.fromEntries(output.trim().split(/\r?\n/u).map((line) => line.split('=', 2)));
  if (state.LoadState !== 'loaded') throw new Error('SYSTEMD_UNIT_NOT_LOADED');
  return Object.freeze({ active: state.ActiveState, sub: state.SubState, result: state.Result, unitFile: state.UnitFileState,
    line: `${service}:active=${state.ActiveState}:sub=${state.SubState}:result=${state.Result}:unitFile=${state.UnitFileState}` });
}

export function internalStatus(port, path, bearerToken, ca, method = 'GET', body = '') {
  return new Promise((resolve, reject) => {
    const request = httpsRequest({ hostname: '127.0.0.1', port, path, method, ca, rejectUnauthorized: true,
      headers: { authorization: `Bearer ${bearerToken}`, ...(body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {}) },
      timeout: 5_000 }, (response) => {
      response.resume();
      response.once('end', () => resolve(response.statusCode ?? 0));
    });
    request.once('timeout', () => request.destroy(new Error('INTERNAL_PROBE_TIMEOUT')));
    request.once('error', reject);
    request.end(body);
  });
}

export function internalResponse(port, path, bearerToken, ca, method = 'GET', body = '', contentType = undefined) {
  return new Promise((resolveResponse, reject) => {
    const payload = typeof body === 'string' ? Buffer.from(body) : Buffer.from(body);
    const request = httpsRequest({ hostname: '127.0.0.1', port, path, method, ca, rejectUnauthorized: true,
      headers: { authorization: `Bearer ${bearerToken}`, ...(payload.byteLength ? { 'content-length': payload.byteLength } : {}),
        ...(contentType ? { 'content-type': contentType } : {}) }, timeout: 5_000 }, (response) => {
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.byteLength;
        if (size > 2 * 1024 * 1024) request.destroy(new Error('INTERNAL_RESPONSE_TOO_LARGE'));
        else chunks.push(chunk);
      });
      response.once('end', () => resolveResponse({ status: response.statusCode ?? 0, body: Buffer.concat(chunks) }));
    });
    request.once('timeout', () => request.destroy(new Error('INTERNAL_PROBE_TIMEOUT')));
    request.once('error', reject);
    request.end(payload);
  });
}

export function signedObjectResponse(url, ca) {
  return new Promise((resolveResponse, reject) => {
    const request = httpsRequest(url, { ca, rejectUnauthorized: true, timeout: 5_000 }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.once('end', () => resolveResponse({ status: response.statusCode ?? 0, body: Buffer.concat(chunks) }));
    });
    request.once('timeout', () => request.destroy(new Error('SIGNED_OBJECT_TIMEOUT')));
    request.once('error', reject);
    request.end();
  });
}

export async function request(url, expectedStatus) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5_000) });
  const body = await response.text();
  if (response.status !== expectedStatus) throw new Error('HTTP_STATUS_INVALID');
  return body;
}
