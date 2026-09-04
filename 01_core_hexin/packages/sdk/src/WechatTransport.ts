import type { Transport, TransportRequest, TransportResponse } from './Transport';
import { errorCause } from './ErrorCause';

export interface WechatRequest {
  readonly url: string;
  readonly method: string;
  readonly header: Readonly<Record<string, string>>;
  readonly data?: string;
  readonly success: (response: Readonly<{ statusCode: number; header: Readonly<Record<string, string>>; data: unknown }>) => void;
  readonly fail: (error: unknown) => void;
}

export interface WechatRequestTask {
  abort(): void;
}

export type WechatRequester = (request: WechatRequest) => WechatRequestTask;

export class WechatTransport implements Transport {
  constructor(private readonly requester: WechatRequester) {}

  send(request: TransportRequest): Promise<TransportResponse> {
    return new Promise((resolve, reject) => {
      const task: { current?: WechatRequestTask } = {};
      let settled = false;
      const detach = () => request.signal?.removeEventListener('abort', abort);
      const succeed = (response: Readonly<{ statusCode: number; header: Readonly<Record<string, string>>; data: unknown }>) => {
        if (settled) return;
        settled = true;
        detach();
        resolve({
          status: response.statusCode,
          headers: response.header,
          body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
        });
      };
      const fail = (cause: unknown) => {
        if (settled) return;
        settled = true;
        detach();
        reject(errorCause(cause, 'WECHAT_REQUEST_FAILED'));
      };
      const abort = () => {
        task.current?.abort();
        fail(request.signal?.reason ?? new Error('REQUEST_ABORTED'));
      };
      request.signal?.addEventListener('abort', abort, { once: true });
      if (request.signal?.aborted) {
        abort();
        return;
      }
      task.current = this.requester({
        url: request.url,
        method: request.method,
        header: request.headers,
        ...(request.body === undefined ? {} : { data: request.body }),
        success: succeed,
        fail,
      });
      if (request.signal?.aborted) abort();
    });
  }
}
