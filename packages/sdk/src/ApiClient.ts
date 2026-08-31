<<<<<<< HEAD
<<<<<<< HEAD
import type { ContractJsonValue, OperationId, OperationInputFor, OperationOutputFor, OperationQuery, Schema } from '@shop/contract';
import { canonicalFinancialActionRequest, requiresFinancialActionProof, requiresFinancialExpectedVersion } from '@shop/contract';
=======
import type {
  ContractJsonValue,
  OperationId,
  OperationInputFor,
  OperationOutputFor,
  OperationQuery,
  Schema,
} from '@shop/contract';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import type { ContractJsonValue, OperationId, OperationInputFor, OperationOutputFor, OperationQuery, Schema } from '@shop/contract';
import { canonicalFinancialActionRequest, requiresFinancialActionProof, requiresFinancialExpectedVersion } from '@shop/contract';
>>>>>>> 018b2a71 (chore(release): capture current production source)
import { CONTRACT_VERSION } from '@shop/contract/version';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { Deadline } from '@shop/kernel/deadline';
import { ApiError } from './error';
import { errorCause } from './ErrorCause';
import type { OperationDescriptor, OperationExecutor } from './OperationDescriptor';
import type { RequestContext } from './RequestContext';
import { RetryPolicy } from './RetryPolicy';
import type { Transport, TransportRequest } from './Transport';

interface WireInput {
  readonly path?: Readonly<Record<string, string>>;
  readonly query?: OperationQuery;
  readonly body?: ContractJsonValue;
}

export class ApiClient implements OperationExecutor {
  constructor(
    private readonly baseUrl: string,
    private readonly transport: Transport,
<<<<<<< HEAD
<<<<<<< HEAD
    private readonly retry = new RetryPolicy()
=======
    private readonly retry = new RetryPolicy(),
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    private readonly retry = new RetryPolicy()
>>>>>>> 018b2a71 (chore(release): capture current production source)
  ) {
    if (!/^https?:\/\//.test(baseUrl)) throw new Error('SDK_BASE_URL_INVALID');
  }

<<<<<<< HEAD
<<<<<<< HEAD
  async execute<TKey extends OperationId>(operation: OperationDescriptor<TKey>, input: OperationInputFor<TKey>, context: RequestContext): Promise<OperationOutputFor<TKey>> {
=======
  async execute<TKey extends OperationId>(
    operation: OperationDescriptor<TKey>,
    input: OperationInputFor<TKey>,
    context: RequestContext,
  ): Promise<OperationOutputFor<TKey>> {
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  async execute<TKey extends OperationId>(operation: OperationDescriptor<TKey>, input: OperationInputFor<TKey>, context: RequestContext): Promise<OperationOutputFor<TKey>> {
>>>>>>> 018b2a71 (chore(release): capture current production source)
    if (context.contractVersion !== CONTRACT_VERSION) throw new Error('SDK_CONTRACT_VERSION_MISMATCH');
    if (operation.method !== 'GET' && operation.audience !== 'provider' && context.idempotencyKey === undefined) {
      throw new Error('SDK_IDEMPOTENCY_KEY_REQUIRED');
    }
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    if (requiresFinancialExpectedVersion(operation.id) && context.expectedVersion === undefined) {
      throw new Error('SDK_EXPECTED_VERSION_REQUIRED');
    }
    if (requiresFinancialActionProof(operation.id) && context.proof === undefined) {
      throw new Error('SDK_ACTION_PROOF_REQUIRED');
    }
<<<<<<< HEAD
    const parsed = operation.input.parse(input);
    const prepared = operation.id === 'identity.stepup.complete' ? await bindStepupActionRequestHash(parsed) : parsed;
    const value = await this.send(operation.path, operation.method, prepared, context, operation.idempotent, operation.output);
    return value;
  }

  private async send<TOutput>(path: string, method: string, input: WireInput, context: RequestContext, idempotent: boolean, output: Schema<TOutput>): Promise<TOutput> {
=======
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    const parsed = operation.input.parse(input);
    const prepared = operation.id === 'identity.stepup.complete' ? await bindStepupActionRequestHash(parsed) : parsed;
    const value = await this.send(operation.path, operation.method, prepared, context, operation.idempotent, operation.output);
    return value;
  }

<<<<<<< HEAD
  private async send<TOutput>(
    path: string,
    method: string,
    input: WireInput,
    context: RequestContext,
    idempotent: boolean,
    output: Schema<TOutput>,
  ): Promise<TOutput> {
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  private async send<TOutput>(path: string, method: string, input: WireInput, context: RequestContext, idempotent: boolean, output: Schema<TOutput>): Promise<TOutput> {
>>>>>>> 018b2a71 (chore(release): capture current production source)
    const deadline = Deadline.after(RUNTIME_LIMITS.http.totalDeadlineMilliseconds, context.signal);
    const request = this.request(path, method, input, context, deadline.signal);
    const canRetry = idempotent || context.idempotencyKey !== undefined;
    let attempt = 1;
    try {
      for (;;) {
        deadline.throwIfExpired();
        try {
          const response = await this.transport.send(request);
          if (response.status >= 200 && response.status < 300) {
            try {
              return output.parse(decode(response.body));
            } catch (cause) {
              throw ApiError.contractResponse(context.traceId, cause);
            }
          }
          const decision = this.retry.decide(attempt, response.status);
          if (!canRetry || !decision.retry) throw ApiError.from(response.status, response.body, context.traceId);
          await delay(decision.delayMs, deadline.signal);
        } catch (cause) {
          if (cause instanceof ApiError) throw cause;
          deadline.throwIfExpired();
          const decision = this.retry.decide(attempt);
          if (!canRetry || !decision.retry) throw cause;
          await delay(decision.delayMs, deadline.signal);
        }
        attempt += 1;
      }
    } finally {
      deadline.dispose();
    }
  }

  private request(pathTemplate: string, method: string, input: WireInput, context: RequestContext, signal: AbortSignal): TransportRequest {
    const path = pathTemplate.replace(/\{([a-z][a-z0-9]*)\}/g, (_match, key: string) => {
      const value = input.path?.[key];
      if (!value) throw new Error(`SDK_PATH_VALUE_MISSING:${key}`);
      return encodeURIComponent(value);
    });
    const url = new URL(path, `${this.baseUrl.replace(/\/$/, '')}/`);
    for (const [key, raw] of Object.entries(input.query ?? {})) {
      if (raw === undefined || raw === null) continue;
      for (const value of Array.isArray(raw) ? raw : [raw]) url.searchParams.append(key, String(value));
    }
    const headers: Record<string, string> = {
      accept: 'application/json',
      'x-contract-version': CONTRACT_VERSION,
      'x-client-version': context.clientVersion,
      'x-trace-id': context.traceId,
    };
    if (input.body !== undefined) headers['content-type'] = 'application/json';
    if (context.scope !== undefined) headers['x-scope-hint'] = context.scope.id;
    if (context.accessVersion !== undefined) headers['x-access-version'] = String(context.accessVersion);
    if (context.idempotencyKey !== undefined) headers['idempotency-key'] = context.idempotencyKey;
    if (context.expectedVersion !== undefined) headers['if-match'] = `"${context.expectedVersion}"`;
    if (context.proof !== undefined) headers['x-action-proof'] = context.proof;
    if (context.csrfToken !== undefined) headers['x-csrf-token'] = context.csrfToken;
    return {
      url: url.toString(),
      method,
      headers: Object.freeze(headers),
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
      signal,
    };
  }
<<<<<<< HEAD
<<<<<<< HEAD
}

async function bindStepupActionRequestHash(input: WireInput): Promise<WireInput> {
  const body = objectValue(input.body);
  const actionValue = Reflect.get(body, 'action');
  if (actionValue === undefined || actionValue === null) return input;
  const action = objectValue(actionValue);
  const operation = Reflect.get(action, 'operation');
  const request = objectValue(Reflect.get(action, 'request'));
  if (typeof operation !== 'string' || !requiresFinancialActionProof(operation)) {
    throw new Error('SDK_ACTION_REQUEST_INVALID');
  }
  let canonical: string;
  try {
    canonical = canonicalFinancialActionRequest({
      operation,
      path: Reflect.get(request, 'path'),
      query: Reflect.get(request, 'query'),
      body: Reflect.get(request, 'body'),
    });
  } catch {
    throw new Error('SDK_ACTION_REQUEST_INVALID');
  }
  const requestHash = await sha256(canonical);
  const provided = Reflect.get(action, 'requestHash');
  if (provided !== undefined && provided !== requestHash) throw new Error('SDK_ACTION_REQUEST_HASH_MISMATCH');
  return {
    ...input,
    body: {
      ...body,
      action: { ...action, requestHash },
    } as ContractJsonValue,
  };
}

function objectValue(value: unknown): Readonly<Record<string, ContractJsonValue | undefined>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('SDK_ACTION_REQUEST_INVALID');
  return value as Readonly<Record<string, ContractJsonValue | undefined>>;
}

async function sha256(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('SDK_SECURE_HASH_SOURCE_UNAVAILABLE');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function decode(body: string): unknown {
  return body.length === 0 ? undefined : (JSON.parse(body) as unknown);
=======
=======
}
>>>>>>> 018b2a71 (chore(release): capture current production source)

async function bindStepupActionRequestHash(input: WireInput): Promise<WireInput> {
  const body = objectValue(input.body);
  const actionValue = Reflect.get(body, 'action');
  if (actionValue === undefined || actionValue === null) return input;
  const action = objectValue(actionValue);
  const operation = Reflect.get(action, 'operation');
  const request = objectValue(Reflect.get(action, 'request'));
  if (typeof operation !== 'string' || !requiresFinancialActionProof(operation)) {
    throw new Error('SDK_ACTION_REQUEST_INVALID');
  }
  let canonical: string;
  try {
    canonical = canonicalFinancialActionRequest({
      operation,
      path: Reflect.get(request, 'path'),
      query: Reflect.get(request, 'query'),
      body: Reflect.get(request, 'body'),
    });
  } catch {
    throw new Error('SDK_ACTION_REQUEST_INVALID');
  }
  const requestHash = await sha256(canonical);
  const provided = Reflect.get(action, 'requestHash');
  if (provided !== undefined && provided !== requestHash) throw new Error('SDK_ACTION_REQUEST_HASH_MISMATCH');
  return {
    ...input,
    body: {
      ...body,
      action: { ...action, requestHash },
    } as ContractJsonValue,
  };
}

function objectValue(value: unknown): Readonly<Record<string, ContractJsonValue | undefined>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('SDK_ACTION_REQUEST_INVALID');
  return value as Readonly<Record<string, ContractJsonValue | undefined>>;
}

async function sha256(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('SDK_SECURE_HASH_SOURCE_UNAVAILABLE');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function decode(body: string): unknown {
<<<<<<< HEAD
  return body.length === 0 ? undefined : JSON.parse(body) as unknown;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  return body.length === 0 ? undefined : (JSON.parse(body) as unknown);
>>>>>>> 018b2a71 (chore(release): capture current production source)
}

async function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw errorCause(signal.reason, 'REQUEST_ABORTED');
  await new Promise<void>((resolve, reject) => {
    const complete = () => {
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    const timer = setTimeout(complete, milliseconds);
    const abort = () => {
      clearTimeout(timer);
      reject(errorCause(signal?.reason, 'REQUEST_ABORTED'));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}
