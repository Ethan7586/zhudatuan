import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { Deadline } from '../performance/Deadline';
import { Executor, type ExecutionMode } from '../performance/Executor';

export type HttpCallMode = ExecutionMode;

export interface HttpCallContext {
  readonly mode: HttpCallMode;
  readonly signal?: AbortSignal;
  readonly deadline?: number;
}

export class HttpClient {
  private readonly executor = new Executor();

  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async send(url: string | URL, init: RequestInit, context: HttpCallContext): Promise<Response> {
    return this.executor.run((deadline) => this.sendOnce(url, init, deadline), { ...context, retryable: retryableTransport });
  }

  private async sendOnce(url: string | URL, init: RequestInit, deadline: Deadline): Promise<Response> {
    deadline.throwIfExpired();
    const controller = new AbortController();
    const abort = () => controller.abort(deadline.signal.reason ?? new Error('DEADLINE_EXCEEDED'));
    deadline.signal.addEventListener('abort', abort, { once: true });
    let phase: 'connection' | 'response' = 'connection';
    let timer = phaseTimer(controller, Math.min(deadline.remaining(), RUNTIME_LIMITS.external.connectionTimeoutMilliseconds));
    try {
      const response = await this.fetcher(url, { ...init, signal: controller.signal, redirect: init.redirect ?? 'error' });
      clearTimeout(timer);
      phase = 'response';
      timer = phaseTimer(controller, Math.min(deadline.remaining(), RUNTIME_LIMITS.external.responseTimeoutMilliseconds));
      const body = await response.arrayBuffer();
      const payload = [204, 205, 304].includes(response.status) ? null : body;
      return new Response(payload, { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (cause) {
      if (deadline.signal.aborted) throw deadline.signal.reason ?? new Error('DEADLINE_EXCEEDED');
      if (controller.signal.aborted) throw new Error(phase === 'connection' ? 'HTTP_CONNECTION_TIMEOUT' : 'HTTP_RESPONSE_TIMEOUT', { cause });
      throw new Error('HTTP_TRANSPORT_FAILED', { cause });
    } finally {
      clearTimeout(timer);
      deadline.signal.removeEventListener('abort', abort);
    }
  }
}

function phaseTimer(controller: AbortController, milliseconds: number): ReturnType<typeof setTimeout> {
  const timer = setTimeout(() => controller.abort(), Math.max(1, milliseconds));
  timer.unref?.();
  return timer;
}

function retryableTransport(cause: unknown): boolean {
  return cause instanceof Error && ['HTTP_CONNECTION_TIMEOUT', 'HTTP_RESPONSE_TIMEOUT', 'HTTP_TRANSPORT_FAILED'].includes(cause.message);
}
