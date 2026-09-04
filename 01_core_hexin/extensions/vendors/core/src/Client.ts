import { randomUUID } from 'node:crypto';

import type { JsonObject, JsonValue, ProviderCallContext } from '@shop/contract';
import { Deadline, retry } from '@shop/kernel';
import type { VendorAuthenticator } from './Auth';
import { CircuitPolicy } from './CircuitPolicy';
import { validateConnection, type VendorConnection } from './Connection';
import { ConcurrencyPolicy, RatePolicy } from './RatePolicy';
import { asVendorFailure, VendorFailure } from './VendorError';

export interface VendorInvocation {
  readonly operation: string;
  readonly method: 'GET' | 'POST';
  readonly body?: JsonObject;
  readonly idempotent: boolean;
}

export class VendorClient {
  private readonly connection: VendorConnection;
  private readonly rate: RatePolicy;
  private readonly concurrency: ConcurrencyPolicy;
  private readonly circuit: CircuitPolicy;

  constructor(connection: VendorConnection, private readonly auth: VendorAuthenticator, private readonly fetcher: typeof fetch = fetch) {
    this.connection = validateConnection(connection);
    this.rate = new RatePolicy(connection.limits.requestsPerSecond);
    this.concurrency = new ConcurrencyPolicy(connection.limits.maxConcurrency);
    this.circuit = new CircuitPolicy(connection.limits.failureThreshold, connection.limits.recoveryMs);
  }

  async invoke(context: ProviderCallContext, invocation: VendorInvocation): Promise<JsonObject> {
    const deadline = Deadline.at(Math.min(context.deadline, Date.now() + this.connection.limits.totalDeadlineMs));
    try {
      await this.rate.acquire(deadline.expiresAt);
      return await this.concurrency.run(() => this.circuit.run(() => this.attempt(context, invocation, deadline)), deadline.signal);
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'DEADLINE_EXCEEDED') throw new VendorFailure('VENDOR_DEADLINE_EXCEEDED', false, undefined, { cause });
      throw cause;
    } finally {
      deadline.dispose();
    }
  }

  async health(): Promise<boolean> {
    const deadline = Date.now() + this.connection.limits.totalDeadlineMs;
    const context: ProviderCallContext = { tenantId: 'health', requestId: randomUUID(), traceId: randomUUID(), deadline };
    try {
      await this.invoke(context, { operation: this.connection.healthOperation, method: 'GET', idempotent: true });
      return true;
    } catch {
      return false;
    }
  }

  circuitState(): 'closed' | 'open' | 'halfopen' {
    return this.circuit.snapshot();
  }

  private async attempt(context: ProviderCallContext, invocation: VendorInvocation, deadline: Deadline): Promise<JsonObject> {
    const attempts = invocation.idempotent || context.idempotencyKey ? this.connection.limits.maxAttempts : 1;
    return retry(() => this.send(context, invocation, deadline), {
      mode: invocation.idempotent ? 'read' : 'businesskeywrite', attempts, minimumDelayMilliseconds: 50, maximumDelayMilliseconds: 1_000,
      deadline, retryable: (cause) => asVendorFailure(cause).retryable,
    }).catch((cause) => { throw asVendorFailure(cause); });
  }

  private async send(context: ProviderCallContext, invocation: VendorInvocation, deadline: Deadline): Promise<JsonObject> {
    const path = this.connection.endpoints[invocation.operation];
    if (!path) throw new VendorFailure('VENDOR_OPERATION_NOT_CONFIGURED', false);
    const body = invocation.body === undefined ? '' : JSON.stringify(invocation.body);
    const timestamp = new Date().toISOString();
    const nonce = randomUUID();
    const auth = await this.auth.authenticate({ method: invocation.method, path, body, timestamp, nonce });
    const controller = new AbortController();
    const abort = () => controller.abort(deadline.signal.reason ?? new Error('VENDOR_DEADLINE_EXCEEDED'));
    deadline.signal.addEventListener('abort', abort, { once: true });
    let phase: 'connection' | 'response' = 'connection';
    let timer = timeout(controller, Math.min(deadline.remaining(), this.connection.limits.connectionTimeoutMs));
    try {
      const response = await this.fetcher(new URL(path, this.connection.baseUrl), {
        method: invocation.method,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-request-id': context.requestId,
          'x-trace-id': context.traceId,
          ...(context.idempotencyKey === undefined ? {} : { 'idempotency-key': context.idempotencyKey }),
          ...auth,
        },
        redirect: 'error',
        signal: controller.signal,
        ...(body ? { body } : {}),
      });
      clearTimeout(timer);
      phase = 'response';
      timer = timeout(controller, Math.min(deadline.remaining(), this.connection.limits.responseTimeoutMs));
      const text = await response.text();
      if (!response.ok) throw new VendorFailure(`VENDOR_HTTP_${response.status}`, response.status === 408 || response.status === 429 || response.status >= 500, response.status);
      const value: unknown = text ? JSON.parse(text) : {};
      if (!isJsonObject(value)) throw new VendorFailure('VENDOR_RESPONSE_INVALID', false);
      return value;
    } catch (error) {
      if (error instanceof SyntaxError) throw new VendorFailure('VENDOR_RESPONSE_INVALID', false, undefined, { cause: error });
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new VendorFailure(deadline.signal.aborted ? 'VENDOR_DEADLINE_EXCEEDED' : phase === 'connection' ? 'VENDOR_CONNECTION_TIMEOUT' : 'VENDOR_RESPONSE_TIMEOUT', true, undefined, { cause: error });
      }
      throw asVendorFailure(error);
    } finally {
      clearTimeout(timer);
      deadline.signal.removeEventListener('abort', abort);
    }
  }
}

function timeout(controller: AbortController, milliseconds: number): ReturnType<typeof setTimeout> {
  const timer = setTimeout(() => controller.abort(), Math.max(1, milliseconds));
  timer.unref?.();
  return timer;
}

function isJsonObject(value: unknown): value is JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): value is JsonValue {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ||
    (Array.isArray(value) && value.every(isJsonValue)) || isJsonObject(value);
}
