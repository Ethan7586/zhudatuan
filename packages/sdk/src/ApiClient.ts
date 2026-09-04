import type { ContractJsonValue, OperationId, OperationInputFor, OperationOutputFor, OperationQuery } from '@shop/contract';
import { HttpHeader } from '@shop/contract/http';
import { CONTRACT_VERSION } from '@shop/contract/version';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { Deadline } from '@shop/kernel/deadline';
import { ApiError, TransportError, isCancelled } from './error';
import { errorCause } from './ErrorCause';
import type { EventStream } from './EventStream';
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
    private readonly retry = new RetryPolicy()
  ) {
    if (!/^https?:\/\//.test(baseUrl)) throw new Error('SDK_BASE_URL_INVALID');
  }

  async execute<TKey extends OperationId>(operation: OperationDescriptor<TKey>, input: OperationInputFor<TKey>, context: RequestContext): Promise<OperationOutputFor<TKey>> {
    if (context.contractVersion !== CONTRACT_VERSION) throw new Error('SDK_CONTRACT_VERSION_MISMATCH');
    if (operation.responseMode === 'stream') throw new Error('SDK_STREAM_OPERATION_REQUIRES_STREAM_METHOD');
    if (operation.idempotencyPolicy !== 'none' && context.idempotencyKey === undefined) {
      throw new Error('SDK_IDEMPOTENCY_KEY_REQUIRED');
    }
    const parsed = operation.input.parse(input);
    const value = await this.send(operation, parsed, context);
    return value;
  }

  stream<TKey extends OperationId>(operation: OperationDescriptor<TKey>, input: OperationInputFor<TKey>, context: RequestContext): EventStream<OperationOutputFor<TKey>> {
    if (context.contractVersion !== CONTRACT_VERSION) throw new Error('SDK_CONTRACT_VERSION_MISMATCH');
    if (operation.method !== 'GET' || operation.responseMode !== 'stream') throw new Error('SDK_OPERATION_NOT_STREAM');
    if (this.transport.open === undefined) throw new Error('SDK_STREAM_TRANSPORT_UNAVAILABLE');
    const parsed = operation.input.parse(input);
    return new DeferredEventStream(async () => {
      const { JsonEventStream } = await import('./EventStream');
      return new JsonEventStream(
        (lastEventId, signal) => this.transport.open!(this.request(operation.path, operation.method, parsed, context, signal, 'text/event-stream', lastEventId)),
        operation.output,
        operation.id,
        operation.errorUnion,
        context.lastEventId,
        context.signal
      );
    });
  }

  private async send<TKey extends OperationId>(operation: OperationDescriptor<TKey>, input: WireInput, context: RequestContext): Promise<OperationOutputFor<TKey>> {
    // Operation timeouts are service SLO budgets; public network latency is governed by the configured HTTP deadline.
    const deadline = Deadline.after(RUNTIME_LIMITS.http.totalDeadlineMilliseconds, context.signal);
    const request = this.request(operation.path, operation.method, input, context, deadline.signal, 'application/json');
    const canRetry = operation.idempotent || context.idempotencyKey !== undefined;
    let attempt = 1;
    try {
      for (;;) {
        if (deadline.remaining() === 0) throw networkFailure(new Error('DEADLINE_EXCEEDED'), context, deadline, operation.id);
        try {
          const response = await this.transport.send(request);
          if (operation.responseMode === 'redirect' && response.status === 303) {
            try {
              const location = response.headers.location;
              if (!location) throw new Error('SDK_REDIRECT_LOCATION_MISSING');
              return operation.output.parse({ location });
            } catch (cause) {
              throw ApiError.contractResponse(context.traceId, cause, operation.id);
            }
          }
          if (response.status === 304) {
            if (context.ifNoneMatch === undefined || context.cachedResponse === undefined) throw ApiError.contractResponse(context.traceId, new Error('SDK_NOT_MODIFIED_CACHE_MISSING'), operation.id);
            try {
              return operation.output.parse(context.cachedResponse);
            } catch (cause) {
              throw ApiError.contractResponse(context.traceId, cause, operation.id);
            }
          }
          if (response.status >= 200 && response.status < 300) {
            try {
              return operation.output.parse(decode(response.body));
            } catch (cause) {
              throw ApiError.contractResponse(context.traceId, cause, operation.id);
            }
          }
          const decision = this.retry.decide(attempt, response.status);
          if (!canRetry || !decision.retry) throw ApiError.from(response.status, response.body, context.traceId, operation.id, operation.errorUnion);
          await delay(decision.delayMs, deadline.signal);
        } catch (cause) {
          if (cause instanceof ApiError || cause instanceof TransportError || isCancelled(cause)) throw cause;
          if (context.signal?.aborted) throw errorCause(context.signal.reason, 'REQUEST_ABORTED');
          if (deadline.signal.aborted || deadline.remaining() === 0) throw networkFailure(cause, context, deadline, operation.id);
          const decision = this.retry.decide(attempt);
          if (!canRetry || !decision.retry) throw networkFailure(cause, context, deadline, operation.id);
          try {
            await delay(decision.delayMs, deadline.signal);
          } catch (delayCause) {
            if (context.signal?.aborted) throw errorCause(context.signal.reason, 'REQUEST_ABORTED');
            throw networkFailure(delayCause, context, deadline, operation.id);
          }
        }
        attempt += 1;
      }
    } finally {
      deadline.dispose();
    }
  }

  private request(pathTemplate: string, method: string, input: WireInput, context: RequestContext, signal: AbortSignal, accept: 'application/json' | 'text/event-stream', lastEventId?: string): TransportRequest {
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
      [HttpHeader.accept]: accept,
      [HttpHeader.contractVersion]: CONTRACT_VERSION,
      [HttpHeader.clientVersion]: context.clientVersion,
      [HttpHeader.traceId]: context.traceId,
    };
    if (input.body !== undefined) headers[HttpHeader.contentType] = 'application/json';
    if (context.scope !== undefined) headers[HttpHeader.scopeHint] = context.scope.id;
    if (context.storefrontHandle !== undefined) headers[HttpHeader.storefrontHandle] = context.storefrontHandle;
    if (context.accessVersion !== undefined) headers[HttpHeader.accessVersion] = String(context.accessVersion);
    if (context.idempotencyKey !== undefined) headers[HttpHeader.idempotencyKey] = context.idempotencyKey;
    if (context.expectedVersion !== undefined) headers[HttpHeader.ifMatch] = `"${context.expectedVersion}"`;
    if (context.ifNoneMatch !== undefined) headers[HttpHeader.ifNoneMatch] = context.ifNoneMatch;
    if (lastEventId !== undefined) headers[HttpHeader.lastEventId] = lastEventId;
    if (context.catalogVersion !== undefined) headers[HttpHeader.navigationCatalog] = context.catalogVersion;
    if (context.proof !== undefined) headers[HttpHeader.actionProof] = context.proof;
    if (context.cartToken !== undefined) headers[HttpHeader.cartToken] = context.cartToken;
    if (context.csrfToken !== undefined) headers[HttpHeader.csrfToken] = context.csrfToken;
    if (context.deviceId !== undefined) headers[HttpHeader.deviceId] = context.deviceId;
    if (context.target !== undefined) headers[HttpHeader.clientTarget] = context.target;
    return {
      url: url.toString(),
      method,
      headers: Object.freeze(headers),
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
      signal,
    };
  }
}

function networkFailure(cause: unknown, context: RequestContext, deadline: Deadline, operation: OperationId): TransportError {
  if (deadline.signal.aborted || deadline.remaining() === 0) return new TransportError('TIMEOUT', context.traceId, true, undefined, { cause }, operation);
  const online = (globalThis as { readonly navigator?: { readonly onLine?: boolean } }).navigator?.onLine;
  if (online === false) return new TransportError('OFFLINE', context.traceId, true, undefined, { cause }, operation);
  return new TransportError('UNAVAILABLE', context.traceId, true, undefined, { cause }, operation);
}

class DeferredEventStream<T> implements EventStream<T> {
  private source: EventStream<T> | undefined;
  private closed = false;
  private consumed = false;

  constructor(private readonly create: () => Promise<EventStream<T>>) {}

  close(): void {
    this.closed = true;
    this.source?.close();
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    if (this.consumed) throw new Error('SDK_STREAM_ALREADY_CONSUMED');
    this.consumed = true;
    return this.events()[Symbol.asyncIterator]();
  }

  private async *events(): AsyncGenerator<T> {
    const source = await this.create();
    this.source = source;
    if (this.closed) {
      source.close();
      return;
    }
    for await (const event of source) yield event;
  }
}

function decode(body: string): unknown {
  return body.length === 0 ? undefined : (JSON.parse(body) as unknown);
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
