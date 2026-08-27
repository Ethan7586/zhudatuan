<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
import { randomUUID } from 'node:crypto';
import type { JsonObject, JsonValue, ProviderCallContext } from '@shop/contract';
import { CircuitPolicy, ConcurrencyPolicy, RatePolicy, asVendorFailure, validateConnection, VendorFailure,
  type VendorConnection } from '@shop/vendorcore';
import { createCakeuncleAuth, requireCakeuncleUserId, type CakeuncleCredential } from './Auth';
import { signCakeuncle } from './Signer';
<<<<<<< HEAD

export interface CakeuncleInvocation {
  readonly operation: string;
  readonly path?: string;
  readonly method?: 'GET' | 'POST';
  readonly encoding?: 'json' | 'form';
  readonly body?: JsonObject;
  readonly idempotent: boolean;
  readonly authenticated?: boolean;
  readonly includeUserId?: boolean;
}

export class CakeuncleClient {
  private readonly connection: VendorConnection;
  private readonly credential: CakeuncleCredential;
  private readonly rate: RatePolicy;
  private readonly concurrency: ConcurrencyPolicy;
  private readonly circuit: CircuitPolicy;

  constructor(connection: VendorConnection, private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now) {
    this.connection = validateConnection(connection);
    this.credential = createCakeuncleAuth(connection.secret);
    this.rate = new RatePolicy(connection.limits.requestsPerSecond,
      Math.max(1, Math.ceil(connection.limits.requestsPerSecond)), now);
    this.concurrency = new ConcurrencyPolicy(connection.limits.maxConcurrency);
    this.circuit = new CircuitPolicy(connection.limits.failureThreshold, connection.limits.recoveryMs, now);
  }

  async invoke(context: ProviderCallContext, invocation: CakeuncleInvocation): Promise<JsonObject> {
    const expiresAt = Math.min(context.deadline, this.now() + this.connection.limits.totalDeadlineMs);
    if (expiresAt <= this.now()) throw new VendorFailure('VENDOR_DEADLINE_EXCEEDED', false);
    await this.rate.acquire(expiresAt);
    const controller = new AbortController();
    const timer = timeout(controller, expiresAt - this.now());
    try {
      return await this.concurrency.run(() => this.attempt(context, invocation, expiresAt), controller.signal);
    } catch (cause) {
      if (controller.signal.aborted || cause instanceof DOMException && cause.name === 'AbortError') {
        throw new VendorFailure('VENDOR_DEADLINE_EXCEEDED', false, undefined, { cause });
      }
      throw cause;
    } finally {
      clearTimeout(timer);
    }
  }

  /** The vendor has no dedicated health route, so the configured safe read endpoint is probed. */
  async health(): Promise<boolean> {
    const deadline = this.now() + this.connection.limits.totalDeadlineMs;
    const context: ProviderCallContext = { tenantId: 'health', requestId: randomUUID(), traceId: randomUUID(), deadline };
    try {
      await this.invoke(context, { operation: this.connection.healthOperation, idempotent: true, body: {} });
      return true;
    } catch { return false; }
  }

  circuitState(): 'closed' | 'open' | 'halfopen' { return this.circuit.snapshot(); }

  private async attempt(context: ProviderCallContext, invocation: CakeuncleInvocation, expiresAt: number): Promise<JsonObject> {
    const attempts = invocation.idempotent ? this.connection.limits.maxAttempts : 1;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const result = await this.circuit.run(async (): Promise<TransportResult> => {
          try { return { ok: true, value: await this.send(context, invocation, expiresAt) }; }
          catch (cause) {
            const failure = asVendorFailure(cause);
            if (failure.retryable) throw failure;
            return { ok: false, failure };
          }
        });
        if (!result.ok) throw result.failure;
        const failure = businessFailure(result.value);
        if (failure?.retryable) await this.circuit.run<never>(() => Promise.reject(failure));
        if (failure) throw failure;
        return result.value;
      } catch (cause) {
        const failure = asVendorFailure(cause);
        if (!invocation.idempotent && failure.retryable) {
          throw new VendorFailure('CAKEUNCLE_WRITE_OUTCOME_UNKNOWN', false, failure.status, { cause: failure });
        }
        if (!failure.retryable || attempt === attempts) throw failure;
        await pause(Math.min(50 * 2 ** (attempt - 1), 1_000), expiresAt, this.now);
      }
    }
    throw new VendorFailure('VENDOR_TRANSPORT_FAILED', false);
  }

  private async send(context: ProviderCallContext, invocation: CakeuncleInvocation, expiresAt: number): Promise<JsonObject> {
    const path = this.connection.endpoints[invocation.operation] ?? invocation.path;
    if (!path || !path.startsWith('/') || path.startsWith('//')) throw new VendorFailure('VENDOR_OPERATION_NOT_CONFIGURED', false);
    const method = invocation.method ?? 'POST';
    const value = this.requestValue(invocation);
    const url = new URL(path, this.connection.baseUrl);
    const encoding = invocation.encoding ?? (method === 'GET' ? 'form' : 'json');
    const encoded = encode(value, encoding);
    if (method === 'GET') url.search = encoded;
    const controller = new AbortController();
    let phase: 'connection' | 'response' = 'connection';
    let timer = timeout(controller, Math.min(remaining(expiresAt, this.now), this.connection.limits.connectionTimeoutMs));
    try {
      const response = await this.fetcher(url, {
        method,
        headers: {
          accept: 'application/json',
          ...(method === 'POST' ? { 'content-type': encoding === 'form'
            ? 'application/x-www-form-urlencoded;charset=UTF-8' : 'application/json' } : {}),
          'x-request-id': context.requestId,
          'x-trace-id': context.traceId,
        },
        redirect: 'error',
        signal: controller.signal,
        ...(method === 'POST' ? { body: encoded } : {}),
      });
      clearTimeout(timer);
      phase = 'response';
      timer = timeout(controller, Math.min(remaining(expiresAt, this.now), this.connection.limits.responseTimeoutMs));
      const text = await readLimited(response);
      if (!response.ok) throw new VendorFailure(`VENDOR_HTTP_${response.status}`,
        response.status === 408 || response.status === 429 || response.status >= 500, response.status);
      const parsed: unknown = text ? JSON.parse(text) : {};
      if (!isJsonObject(parsed)) throw new VendorFailure('VENDOR_RESPONSE_INVALID', false);
      return parsed;
    } catch (cause) {
      if (cause instanceof SyntaxError) throw new VendorFailure('VENDOR_RESPONSE_INVALID', false, undefined, { cause });
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        const deadline = this.now() >= expiresAt;
        throw new VendorFailure(deadline ? 'VENDOR_DEADLINE_EXCEEDED' : phase === 'connection'
          ? 'VENDOR_CONNECTION_TIMEOUT' : 'VENDOR_RESPONSE_TIMEOUT', !deadline, undefined, { cause });
      }
      throw asVendorFailure(cause);
    } finally {
      clearTimeout(timer);
    }
  }

  private requestValue(invocation: CakeuncleInvocation): JsonObject {
    const body = invocation.body ?? {};
    if (invocation.authenticated === false) return body;
    const timestamp = Math.floor(this.now() / 1_000).toString();
    return Object.freeze({ ...body,
      ...(invocation.includeUserId ? { user_id: requireCakeuncleUserId(this.credential) } : {}),
      channel_no: this.credential.channelNo,
      timestamp,
      sign: signCakeuncle(this.credential.channelNo, this.credential.channelKey, timestamp),
    });
  }
}

export function createCakeuncleClient(connection: VendorConnection, fetcher?: typeof fetch): CakeuncleClient {
  return new CakeuncleClient(connection, fetcher);
}

function businessFailure(value: JsonObject): VendorFailure | null {
  if (value.code === undefined) return new VendorFailure('CAKEUNCLE_RESPONSE_CODE_MISSING', false);
  if (String(value.code) === '200') return null;
  const code = String(value.code);
  return new VendorFailure(`CAKEUNCLE_API_${code}`, code === '900');
}

type TransportResult = { readonly ok: true; readonly value: JsonObject } |
  { readonly ok: false; readonly failure: VendorFailure };

async function readLimited(response: Response, maximumBytes = 2_097_152): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maximumBytes) throw new VendorFailure('VENDOR_RESPONSE_TOO_LARGE', false);
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new VendorFailure('VENDOR_RESPONSE_TOO_LARGE', false);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total).toString('utf8');
}

function encode(value: JsonObject, encoding: 'json' | 'form'): string {
  if (encoding === 'json') return JSON.stringify(value);
  const form = new URLSearchParams();
  Object.entries(value).forEach(([key, item]) => form.set(key, scalar(item) ? String(item ?? '') : JSON.stringify(item)));
  return form.toString();
}

function scalar(value: JsonValue): value is string | number | boolean | null {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function remaining(expiresAt: number, now: () => number): number {
  const value = expiresAt - now();
  if (value <= 0) throw new VendorFailure('VENDOR_DEADLINE_EXCEEDED', false);
  return value;
}

function timeout(controller: AbortController, milliseconds: number): ReturnType<typeof setTimeout> {
  const timer = setTimeout(() => controller.abort(), Math.max(1, milliseconds));
  timer.unref?.();
  return timer;
}

function pause(milliseconds: number, expiresAt: number, now: () => number): Promise<void> {
  if (now() + milliseconds >= expiresAt) return Promise.reject(new VendorFailure('VENDOR_DEADLINE_EXCEEDED', false));
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref?.();
  });
}

function isJsonObject(value: unknown): value is JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): value is JsonValue {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ||
    (Array.isArray(value) && value.every(isJsonValue)) || isJsonObject(value);
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
import { VendorClient, type VendorConnection } from '@shop/vendorcore';
import { createCakeuncleAuth } from './Auth';

export function createCakeuncleClient(connection: VendorConnection, fetcher?: typeof fetch): VendorClient {
  return new VendorClient(connection, createCakeuncleAuth(connection.secret), fetcher);
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======

export interface CakeuncleInvocation {
  readonly operation: string;
  readonly path?: string;
  readonly method?: 'GET' | 'POST';
  readonly encoding?: 'json' | 'form';
  readonly body?: JsonObject;
  readonly idempotent: boolean;
  readonly authenticated?: boolean;
  readonly includeUserId?: boolean;
}

export class CakeuncleClient {
  private readonly connection: VendorConnection;
  private readonly credential: CakeuncleCredential;
  private readonly rate: RatePolicy;
  private readonly concurrency: ConcurrencyPolicy;
  private readonly circuit: CircuitPolicy;

  constructor(connection: VendorConnection, private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now) {
    this.connection = validateConnection(connection);
    this.credential = createCakeuncleAuth(connection.secret);
    this.rate = new RatePolicy(connection.limits.requestsPerSecond,
      Math.max(1, Math.ceil(connection.limits.requestsPerSecond)), now);
    this.concurrency = new ConcurrencyPolicy(connection.limits.maxConcurrency);
    this.circuit = new CircuitPolicy(connection.limits.failureThreshold, connection.limits.recoveryMs, now);
  }

  async invoke(context: ProviderCallContext, invocation: CakeuncleInvocation): Promise<JsonObject> {
    const expiresAt = Math.min(context.deadline, this.now() + this.connection.limits.totalDeadlineMs);
    if (expiresAt <= this.now()) throw new VendorFailure('VENDOR_DEADLINE_EXCEEDED', false);
    await this.rate.acquire(expiresAt);
    const controller = new AbortController();
    const timer = timeout(controller, expiresAt - this.now());
    try {
      return await this.concurrency.run(() => this.attempt(context, invocation, expiresAt), controller.signal);
    } catch (cause) {
      if (controller.signal.aborted || cause instanceof DOMException && cause.name === 'AbortError') {
        throw new VendorFailure('VENDOR_DEADLINE_EXCEEDED', false, undefined, { cause });
      }
      throw cause;
    } finally {
      clearTimeout(timer);
    }
  }

  /** The vendor has no dedicated health route, so the configured safe read endpoint is probed. */
  async health(): Promise<boolean> {
    const deadline = this.now() + this.connection.limits.totalDeadlineMs;
    const context: ProviderCallContext = { tenantId: 'health', requestId: randomUUID(), traceId: randomUUID(), deadline };
    try {
      await this.invoke(context, { operation: this.connection.healthOperation, idempotent: true, body: {} });
      return true;
    } catch { return false; }
  }

  circuitState(): 'closed' | 'open' | 'halfopen' { return this.circuit.snapshot(); }

  private async attempt(context: ProviderCallContext, invocation: CakeuncleInvocation, expiresAt: number): Promise<JsonObject> {
    const attempts = invocation.idempotent ? this.connection.limits.maxAttempts : 1;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const result = await this.circuit.run(async (): Promise<TransportResult> => {
          try { return { ok: true, value: await this.send(context, invocation, expiresAt) }; }
          catch (cause) {
            const failure = asVendorFailure(cause);
            if (failure.retryable) throw failure;
            return { ok: false, failure };
          }
        });
        if (!result.ok) throw result.failure;
        const failure = businessFailure(result.value);
        if (failure?.retryable) await this.circuit.run<never>(() => Promise.reject(failure));
        if (failure) throw failure;
        return result.value;
      } catch (cause) {
        const failure = asVendorFailure(cause);
        if (!invocation.idempotent && failure.retryable) {
          throw new VendorFailure('CAKEUNCLE_WRITE_OUTCOME_UNKNOWN', false, failure.status, { cause: failure });
        }
        if (!failure.retryable || attempt === attempts) throw failure;
        await pause(Math.min(50 * 2 ** (attempt - 1), 1_000), expiresAt, this.now);
      }
    }
    throw new VendorFailure('VENDOR_TRANSPORT_FAILED', false);
  }

  private async send(context: ProviderCallContext, invocation: CakeuncleInvocation, expiresAt: number): Promise<JsonObject> {
    const path = this.connection.endpoints[invocation.operation] ?? invocation.path;
    if (!path || !path.startsWith('/') || path.startsWith('//')) throw new VendorFailure('VENDOR_OPERATION_NOT_CONFIGURED', false);
    const method = invocation.method ?? 'POST';
    const value = this.requestValue(invocation);
    const url = new URL(path, this.connection.baseUrl);
    const encoding = invocation.encoding ?? (method === 'GET' ? 'form' : 'json');
    const encoded = encode(value, encoding);
    if (method === 'GET') url.search = encoded;
    const controller = new AbortController();
    let phase: 'connection' | 'response' = 'connection';
    let timer = timeout(controller, Math.min(remaining(expiresAt, this.now), this.connection.limits.connectionTimeoutMs));
    try {
      const response = await this.fetcher(url, {
        method,
        headers: {
          accept: 'application/json',
          ...(method === 'POST' ? { 'content-type': encoding === 'form'
            ? 'application/x-www-form-urlencoded;charset=UTF-8' : 'application/json' } : {}),
          'x-request-id': context.requestId,
          'x-trace-id': context.traceId,
        },
        redirect: 'error',
        signal: controller.signal,
        ...(method === 'POST' ? { body: encoded } : {}),
      });
      clearTimeout(timer);
      phase = 'response';
      timer = timeout(controller, Math.min(remaining(expiresAt, this.now), this.connection.limits.responseTimeoutMs));
      const text = await readLimited(response);
      if (!response.ok) throw new VendorFailure(`VENDOR_HTTP_${response.status}`,
        response.status === 408 || response.status === 429 || response.status >= 500, response.status);
      const parsed: unknown = text ? JSON.parse(text) : {};
      if (!isJsonObject(parsed)) throw new VendorFailure('VENDOR_RESPONSE_INVALID', false);
      return parsed;
    } catch (cause) {
      if (cause instanceof SyntaxError) throw new VendorFailure('VENDOR_RESPONSE_INVALID', false, undefined, { cause });
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        const deadline = this.now() >= expiresAt;
        throw new VendorFailure(deadline ? 'VENDOR_DEADLINE_EXCEEDED' : phase === 'connection'
          ? 'VENDOR_CONNECTION_TIMEOUT' : 'VENDOR_RESPONSE_TIMEOUT', !deadline, undefined, { cause });
      }
      throw asVendorFailure(cause);
    } finally {
      clearTimeout(timer);
    }
  }

  private requestValue(invocation: CakeuncleInvocation): JsonObject {
    const body = invocation.body ?? {};
    if (invocation.authenticated === false) return body;
    const timestamp = Math.floor(this.now() / 1_000).toString();
    return Object.freeze({ ...body,
      ...(invocation.includeUserId ? { user_id: requireCakeuncleUserId(this.credential) } : {}),
      channel_no: this.credential.channelNo,
      timestamp,
      sign: signCakeuncle(this.credential.channelNo, this.credential.channelKey, timestamp),
    });
  }
}

export function createCakeuncleClient(connection: VendorConnection, fetcher?: typeof fetch): CakeuncleClient {
  return new CakeuncleClient(connection, fetcher);
}

function businessFailure(value: JsonObject): VendorFailure | null {
  if (value.code === undefined) return new VendorFailure('CAKEUNCLE_RESPONSE_CODE_MISSING', false);
  if (String(value.code) === '200') return null;
  const code = String(value.code);
  return new VendorFailure(`CAKEUNCLE_API_${code}`, code === '900');
}

type TransportResult = { readonly ok: true; readonly value: JsonObject } |
  { readonly ok: false; readonly failure: VendorFailure };

async function readLimited(response: Response, maximumBytes = 2_097_152): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maximumBytes) throw new VendorFailure('VENDOR_RESPONSE_TOO_LARGE', false);
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new VendorFailure('VENDOR_RESPONSE_TOO_LARGE', false);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total).toString('utf8');
}

function encode(value: JsonObject, encoding: 'json' | 'form'): string {
  if (encoding === 'json') return JSON.stringify(value);
  const form = new URLSearchParams();
  Object.entries(value).forEach(([key, item]) => form.set(key, scalar(item) ? String(item ?? '') : JSON.stringify(item)));
  return form.toString();
}

function scalar(value: JsonValue): value is string | number | boolean | null {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function remaining(expiresAt: number, now: () => number): number {
  const value = expiresAt - now();
  if (value <= 0) throw new VendorFailure('VENDOR_DEADLINE_EXCEEDED', false);
  return value;
}

function timeout(controller: AbortController, milliseconds: number): ReturnType<typeof setTimeout> {
  const timer = setTimeout(() => controller.abort(), Math.max(1, milliseconds));
  timer.unref?.();
  return timer;
}

function pause(milliseconds: number, expiresAt: number, now: () => number): Promise<void> {
  if (now() + milliseconds >= expiresAt) return Promise.reject(new VendorFailure('VENDOR_DEADLINE_EXCEEDED', false));
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref?.();
  });
}

function isJsonObject(value: unknown): value is JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): value is JsonValue {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ||
    (Array.isArray(value) && value.every(isJsonValue)) || isJsonObject(value);
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}
