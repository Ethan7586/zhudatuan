import { DomainError } from '../error/DomainError';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { Deadline, Executor, type ExecutionMode } from '@shop/kernel';
import { NetworkPolicy } from '../security/NetworkPolicy';
import { Failure, mapFailure } from '../error/Failure';

export type HttpCallMode = ExecutionMode;

export interface HttpCallContext {
  readonly mode: HttpCallMode;
  readonly signal?: AbortSignal | undefined;
  readonly deadline?: number | undefined;
}

export class HttpClient {
  private readonly executor = new Executor(RUNTIME_LIMITS.external);

  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly network = new NetworkPolicy()
  ) {}

  async send(url: string | URL, init: RequestInit, context: HttpCallContext): Promise<Response> {
    return this.executor.run((deadline) => this.sendOnce(url, init, deadline), { ...context, retryable: retryableTransport });
  }

  private async sendOnce(url: string | URL, init: RequestInit, deadline: Deadline): Promise<Response> {
    deadline.throwIfExpired();
    const target = this.fetcher === globalThis.fetch ? await this.network.assert(url) : syntacticTarget(url);
    const controller = new AbortController();
    const abort = () => controller.abort(deadline.signal.reason ?? new DomainError('DEADLINE_EXCEEDED'));
    deadline.signal.addEventListener('abort', abort, { once: true });
    let phase: 'connection' | 'response' = 'connection';
    let timer = phaseTimer(controller, Math.min(deadline.remaining(), RUNTIME_LIMITS.external.connectionTimeoutMilliseconds));
    try {
      const response = await this.fetcher(target, { ...init, signal: controller.signal, redirect: 'error' });
      clearTimeout(timer);
      phase = 'response';
      timer = phaseTimer(controller, Math.min(deadline.remaining(), RUNTIME_LIMITS.external.responseTimeoutMilliseconds));
      const length = Number(response.headers.get('content-length') ?? 0);
      if (Number.isFinite(length) && length > RUNTIME_LIMITS.external.maximumResponseBytes) throw new Failure('HTTP_RESPONSE_TOO_LARGE', 'response', false, response.status);
      const body = await boundedBody(response, RUNTIME_LIMITS.external.maximumResponseBytes);
      const payload = [204, 205, 304].includes(response.status) ? null : body;
      return new Response(payload, { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (cause) {
      if (cause instanceof Failure) throw cause;
      if (deadline.signal.aborted) throw new Failure('DEADLINE_EXCEEDED', 'timeout', false, undefined, { cause: deadline.signal.reason ?? cause });
      if (controller.signal.aborted) throw new Failure(phase === 'connection' ? 'HTTP_CONNECTION_TIMEOUT' : 'HTTP_RESPONSE_TIMEOUT', 'timeout', true, undefined, { cause });
      throw mapFailure(cause, { code: 'HTTP_TRANSPORT_FAILED', kind: 'transport', retryable: true });
    } finally {
      clearTimeout(timer);
      deadline.signal.removeEventListener('abort', abort);
    }
  }
}

function syntacticTarget(value: string | URL): URL {
  const url = value instanceof URL ? new URL(value) : new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443')) throw new Error('NETWORK_ENDPOINT_INVALID');
  return url;
}

async function boundedBody(response: Response, maximum: number): Promise<ArrayBuffer> {
  if (!response.body) return new ArrayBuffer(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximum) {
        await reader.cancel();
        throw new Failure('HTTP_RESPONSE_TOO_LARGE', 'response', false, response.status);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new ArrayBuffer(total);
  const output = new Uint8Array(buffer);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
}

function phaseTimer(controller: AbortController, milliseconds: number): ReturnType<typeof setTimeout> {
  const timer = setTimeout(() => controller.abort(), Math.max(1, milliseconds));
  timer.unref?.();
  return timer;
}

function retryableTransport(cause: unknown): boolean {
  return cause instanceof Failure && cause.retryable;
}
