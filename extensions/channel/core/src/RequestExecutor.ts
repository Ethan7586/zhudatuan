import { randomUUID } from 'node:crypto';

import type { JsonObject, JsonValue, ProviderCallContext } from '@shop/contract';
import { Deadline, retry } from '@shop/kernel';
import type { IntegrationAuthenticator } from './integration/Auth';
import { CircuitPolicy } from './integration/CircuitPolicy';
import { validateConnection, type IntegrationConnection } from './integration/Connection';
import { asIntegrationFailure, IntegrationFailure } from './integration/IntegrationError';
import { ConcurrencyPolicy, RatePolicy } from './integration/RatePolicy';

export interface ProviderInvocation {
  readonly operation: string;
  readonly method: 'GET' | 'POST';
  readonly body?: JsonObject;
  readonly idempotent: boolean;
}

export interface ProviderRequestMetric {
  readonly connectionId: string;
  readonly operation: string;
  readonly traceId: string;
  readonly durationMs: number;
  readonly outcome: 'succeeded' | 'failed';
  readonly errorCode?: string;
}

export interface ProviderTelemetry {
  record(metric: ProviderRequestMetric): void;
}

const SILENT_TELEMETRY: ProviderTelemetry = Object.freeze({ record: () => undefined });

export class RequestExecutor {
  private readonly connection: IntegrationConnection;
  private readonly rate: RatePolicy;
  private readonly concurrency: ConcurrencyPolicy;
  private readonly circuit: CircuitPolicy;

  constructor(
    connection: IntegrationConnection,
    private readonly auth: IntegrationAuthenticator,
    private readonly fetcher: typeof fetch = fetch,
    private readonly telemetry: ProviderTelemetry = SILENT_TELEMETRY
  ) {
    this.connection = validateConnection(connection);
    this.rate = new RatePolicy(connection.limits.requestsPerSecond);
    this.concurrency = new ConcurrencyPolicy(connection.limits.maxConcurrency);
    this.circuit = new CircuitPolicy(connection.limits.failureThreshold, connection.limits.recoveryMs);
  }

  async invoke(context: ProviderCallContext, invocation: ProviderInvocation): Promise<JsonObject> {
    const startedAt = Date.now();
    const deadline = Deadline.at(Math.min(context.deadline, startedAt + this.connection.limits.totalDeadlineMs), context.signal);
    try {
      await this.rate.acquire(deadline.expiresAt, deadline.signal);
      const result = await this.concurrency.run(() => this.circuit.run(() => this.attempt(context, invocation, deadline)), deadline.signal);
      this.observe(Object.freeze({ connectionId: this.connection.id, operation: invocation.operation, traceId: context.traceId, durationMs: Date.now() - startedAt, outcome: 'succeeded' }));
      return result;
    } catch (cause) {
      const failure = context.signal?.aborted
        ? new IntegrationFailure('PROVIDER_REQUEST_CANCELLED', false, undefined, { cause })
        : cause instanceof Error && cause.message === 'DEADLINE_EXCEEDED'
          ? new IntegrationFailure('PROVIDER_DEADLINE_EXCEEDED', false, undefined, { cause })
          : asIntegrationFailure(cause);
      this.observe(Object.freeze({ connectionId: this.connection.id, operation: invocation.operation, traceId: context.traceId, durationMs: Date.now() - startedAt, outcome: 'failed', errorCode: failure.code }));
      throw failure;
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

  private observe(metric: ProviderRequestMetric): void {
    try {
      this.telemetry.record(metric);
    } catch {
      // Telemetry is deliberately fail-open and never changes a provider outcome.
    }
  }

  private async attempt(context: ProviderCallContext, invocation: ProviderInvocation, deadline: Deadline): Promise<JsonObject> {
    const attempts = invocation.idempotent || context.idempotencyKey ? this.connection.limits.maxAttempts : 1;
    return retry(() => this.send(context, invocation, deadline), {
      mode: invocation.idempotent ? 'read' : 'businesskeywrite',
      attempts,
      minimumDelayMilliseconds: 50,
      maximumDelayMilliseconds: 1_000,
      deadline,
      retryable: (cause) => asIntegrationFailure(cause).retryable,
    }).catch((cause) => {
      throw asIntegrationFailure(cause);
    });
  }

  private async send(context: ProviderCallContext, invocation: ProviderInvocation, deadline: Deadline): Promise<JsonObject> {
    const path = this.connection.endpoints[invocation.operation];
    if (!path) throw new IntegrationFailure('PROVIDER_OPERATION_NOT_CONFIGURED', false);
    const body = invocation.body === undefined ? '' : JSON.stringify(invocation.body);
    const timestamp = new Date().toISOString();
    const nonce = randomUUID();
    const auth = await this.auth.authenticate({ method: invocation.method, path, body, timestamp, nonce });
    const controller = new AbortController();
    const abort = () => controller.abort(deadline.signal.reason ?? new Error('PROVIDER_DEADLINE_EXCEEDED'));
    deadline.signal.addEventListener('abort', abort, { once: true });
    let phase: 'connection' | 'response' = 'connection';
    let timer = timeout(controller, Math.min(deadline.remaining(), this.connection.limits.connectionTimeoutMs));
    try {
      const response = await this.fetcher(new URL(path, this.connection.baseUrl), {
        method: invocation.method,
        headers: { accept: 'application/json', 'content-type': 'application/json', 'x-request-id': context.requestId, 'x-trace-id': context.traceId, ...(context.idempotencyKey === undefined ? {} : { 'idempotency-key': context.idempotencyKey }), ...auth },
        redirect: 'error',
        signal: controller.signal,
        ...(body ? { body } : {}),
      });
      clearTimeout(timer);
      phase = 'response';
      timer = timeout(controller, Math.min(deadline.remaining(), this.connection.limits.responseTimeoutMs));
      const text = await response.text();
      if (!response.ok) throw new IntegrationFailure(`PROVIDER_HTTP_${response.status}`, response.status === 408 || response.status === 429 || response.status >= 500, response.status);
      const value: unknown = text ? JSON.parse(text) : {};
      if (!isJsonObject(value)) throw new IntegrationFailure('PROVIDER_RESPONSE_INVALID', false);
      return value;
    } catch (error) {
      if (error instanceof SyntaxError) throw new IntegrationFailure('PROVIDER_RESPONSE_INVALID', false, undefined, { cause: error });
      if (error instanceof DOMException && error.name === 'AbortError') throw new IntegrationFailure(deadline.signal.aborted ? 'PROVIDER_DEADLINE_EXCEEDED' : phase === 'connection' ? 'PROVIDER_CONNECTION_TIMEOUT' : 'PROVIDER_RESPONSE_TIMEOUT', true, undefined, { cause: error });
      throw asIntegrationFailure(error);
    } finally {
      clearTimeout(timer);
      deadline.signal.removeEventListener('abort', abort);
    }
  }
}

export function redactProviderValue(value: unknown, key = ''): unknown {
  if (/secret|token|credential|authorization|signature|privatekey|code/i.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => redactProviderValue(item));
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, redactProviderValue(child, childKey)]));
  return value;
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
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || (Array.isArray(value) && value.every(isJsonValue)) || isJsonObject(value);
}
