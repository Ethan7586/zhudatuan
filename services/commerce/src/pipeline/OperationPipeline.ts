import { operationSchema, OperationCatalog, type ApiErrorCode, type OperationId, type OperationInputFor } from '@shop/contract';
import { errorStatus } from '@shop/contract/errors';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { Bulkhead } from '@shop/kernel';
import { ApplicationError } from '../platform/error/ApplicationError';
import type { HttpRequest } from '../platform/http/HttpRequest';
import type { HttpResponse } from '../platform/http/HttpResponse';
import type { HandlerRegistry } from './HandlerRegistry';
import type { OperationPolicy } from './OperationPolicy';
import type { PublicActorFingerprint } from '../platform/security/PublicActorFingerprint';
import type { OperationExecutor } from './OperationExecutor';
import { isHttpStream } from '../platform/http/HttpStream';

export class OperationPipeline {
  private readonly bulkhead = new Bulkhead(RUNTIME_LIMITS.http.maximumConcurrency, RUNTIME_LIMITS.http.maximumQueue);

  constructor(
    private readonly handlers: HandlerRegistry,
    private readonly policy: OperationPolicy,
    private readonly publicActors: PublicActorFingerprint,
    private readonly executor: OperationExecutor
  ) {}

  execute<TKey extends OperationId>(operationId: TKey, request: HttpRequest): Promise<HttpResponse> {
    return this.bulkhead
      .run(() => this.run(operationId, request), request.signal)
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.message === 'BULKHEAD_REJECTED') throw new ApplicationError('RATE_LIMITED');
        throw cause;
      });
  }

  private async run<TKey extends OperationId>(operationId: TKey, request: HttpRequest): Promise<HttpResponse> {
    const operation = OperationCatalog.get(operationId);
    const schema = operationSchema(operationId);
    const input = schema.input.parse({
      ...(Object.keys(request.parameters).length === 0 ? {} : { path: request.parameters }),
      ...(request.query.size === 0 ? {} : { query: queryObject(request.query) }),
      ...(request.method === 'GET' ? {} : { body: operation.audience === 'webhook' ? {} : request.body }),
    });
    const idempotencyKey = request.headers['idempotency-key'];
    if (operation.idempotencyScope !== 'none' && operation.audience !== 'webhook' && idempotencyKey === undefined) {
      throw new ApplicationError('IDEMPOTENCY_KEY_REQUIRED');
    }
    const expectedVersion = expectedVersionOf(request.headers['if-match']);
    if (operation.expectedVersion === 'required' && expectedVersion === undefined) throw new ApplicationError('EXPECTED_VERSION_REQUIRED');
    const authorization = await this.policy.authorize({ operation, input, headers: request.headers, deadline: request.deadline, signal: request.signal });
    const security = authorization.security;
    const publicActor = security.kind === 'session' ? undefined : this.publicActors.create(operation, input, request.headers);
    const handler = this.handlers.get(operationId);
    const context = {
      requestId: request.headers['x-request-id'] ?? 'request:missing',
      traceId: request.headers['x-trace-id'] ?? request.headers['x-request-id'] ?? 'trace:missing',
      deadline: request.deadline,
      signal: request.signal,
      operation: operationId,
      security,
      headers: request.headers,
      rawBody: request.rawBody,
      ...(publicActor === undefined ? {} : { publicActor }),
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
      ...(expectedVersion === undefined ? {} : { expectedVersion }),
      ...(request.headers['x-action-proof'] === undefined ? {} : { actionProof: request.headers['x-action-proof'] }),
    } as const;
    const execute = () =>
      this.executor.execute(handler, input as OperationInputFor<TKey>, context).catch((cause: unknown) => {
        if (cause instanceof ApplicationError && !(operation.errorUnion as readonly string[]).includes(cause.code)) {
          throw new ApplicationError('INTERNAL_ERROR', {}, cause);
        }
        throw cause;
      });
    const reply = operation.method === 'GET' ? await completeRead(execute(), authorization.decision) : await completeWrite(execute, authorization.decision);
    if (!operationSuccess(operation.responseMode, reply.status)) throw operationError(operation.errorUnion, reply.status, reply.body);
    if (operation.responseMode === 'stream') {
      if (reply.status !== 200 || !isHttpStream(reply.body)) throw new ApplicationError('INTERNAL_ERROR');
      return { status: reply.status, body: reply.body, ...(reply.headers === undefined ? {} : { headers: reply.headers }) };
    }
    const output = schema.output.parse(normalizeContractOutput(operation.responseMode === 'redirect' ? { location: reply.headers?.location } : reply.body));
    return { status: reply.status, body: operation.responseMode === 'redirect' ? undefined : output, ...(reply.headers === undefined ? {} : { headers: reply.headers }) };
  }
}

async function completeRead<T>(read: Promise<T>, decision: Promise<void>): Promise<T> {
  try {
    const [result] = await Promise.all([read, decision]);
    return result;
  } catch (cause) {
    try {
      await decision;
    } catch (decisionFailure) {
      throw decisionFailure;
    }
    throw cause;
  }
}

async function completeWrite<T>(write: () => Promise<T>, decision: Promise<void>): Promise<T> {
  await decision;
  return write();
}

function normalizeContractOutput(value: unknown): unknown {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new ApplicationError('INTERNAL_ERROR');
    return value.toISOString();
  }
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new ApplicationError('INTERNAL_ERROR');
    return value;
  }
  if (Array.isArray(value)) return value.map(normalizeContractOutput);
  if (typeof value !== 'object') throw new ApplicationError('INTERNAL_ERROR');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new ApplicationError('INTERNAL_ERROR');
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeContractOutput(item)]));
}

function operationSuccess(mode: 'json' | 'empty' | 'redirect' | 'stream', status: number): boolean {
  return (status >= 200 && status < 300) || (mode === 'redirect' && status === 303);
}

function operationError(union: readonly string[], status: number, body: unknown): ApplicationError {
  const code = body !== null && typeof body === 'object' && !Array.isArray(body) && typeof Reflect.get(body, 'code') === 'string' ? (Reflect.get(body, 'code') as string) : '';
  if (!union.includes(code) || errorStatus(code as ApiErrorCode) !== status) return new ApplicationError('INTERNAL_ERROR');
  return new ApplicationError(code as ApiErrorCode);
}

function expectedVersionOf(header: string | undefined): number | undefined {
  if (header === undefined) return undefined;
  const normalized = header.replace(/^W\//, '').replace(/^"|"$/g, '');
  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value < 0) throw new ApplicationError('EXPECTED_VERSION_INVALID');
  return value;
}

function queryObject(parameters: URLSearchParams): Readonly<Record<string, string | readonly string[]>> {
  return Object.freeze(
    Object.fromEntries(
      [...new Set(parameters.keys())].map((key) => {
        const values = parameters.getAll(key);
        return [key, values.length === 1 ? values[0]! : Object.freeze(values)];
      })
    )
  );
}
