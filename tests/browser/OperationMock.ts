import type { Page, Request, Route } from '@playwright/test';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import { API_ORIGIN } from './Origins';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { API_ORIGIN } from './Origins';
>>>>>>> 05ea98a5 (fix(release): restore selected app verification)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

export interface OperationCall {
  readonly method: string;
  readonly path: string;
  readonly query: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
}

type Responder = (call: OperationCall) => unknown;

interface RegisteredOperation {
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly respond: Responder;
}

export class OperationMock {
  readonly calls: OperationCall[] = [];
  readonly unmatched: OperationCall[] = [];
  readonly cancelled: OperationCall[] = [];
  private readonly operations: RegisteredOperation[] = [];

  constructor(private readonly page: Page) {}

  get(path: string, respond: Responder, status?: number): this;
  get(path: string, body: unknown, status?: number): this;
  get(path: string, body: unknown, status = 200): this {
    return this.register('GET', path, body, status);
  }

  post(path: string, respond: Responder, status?: number): this;
  post(path: string, body: unknown, status?: number): this;
  post(path: string, body: unknown, status = 200): this {
    return this.register('POST', path, body, status);
  }

  async install(): Promise<void> {
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    await this.page.route(`${API_ORIGIN}/api/v1/**`, (route) => this.dispatch(route));
=======
    await this.page.route('http://127.0.0.1:4311/api/v1/**', (route) => this.dispatch(route));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    await this.page.route(`${API_ORIGIN}/api/v1/**`, (route) => this.dispatch(route));
>>>>>>> 05ea98a5 (fix(release): restore selected app verification)
=======
    await this.page.route('http://127.0.0.1:4311/api/v1/**', (route) => this.dispatch(route));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  }

  private register(method: string, path: string, body: unknown, status: number): this {
    const respond = isResponder(body) ? body : () => body;
    this.operations.push({ method, path, status, respond });
    return this;
  }

  private async dispatch(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') {
      await route.fulfill(preflight(request.headers().origin));
      return;
    }
    const call = operationCall(request, url);
    this.calls.push(call);
    const operation = this.operations.find((candidate) => candidate.method === call.method && candidate.path === call.path);
    if (operation === undefined) {
      this.unmatched.push(call);
      await route.fulfill(response(501, { code: 'E2E_OPERATION_NOT_REGISTERED', method: call.method, path: call.path }, call.headers.origin));
      return;
    }
    const body = await operation.respond(call);
    try {
      await route.fulfill(response(operation.status, body, call.headers.origin));
    } catch (cause) {
      if (request.failure() === null) {
        if (cause instanceof Error) throw cause;
        throw new Error('E2E_FULFILL_FAILED', { cause });
      }
      this.cancelled.push(call);
    }
  }
}

function operationCall(request: Request, url: URL): OperationCall {
  const raw = request.postData();
  let body: unknown;
  if (raw !== null) {
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      body = raw;
    }
  }
  return Object.freeze({
    method: request.method(),
    path: url.pathname,
    query: url.search,
    headers: Object.freeze(request.headers()),
    body,
  });
}

function isResponder(value: unknown): value is Responder {
  return typeof value === 'function';
}

function response(status: number, body: unknown, origin?: string) {
  return {
    status,
    contentType: 'application/json; charset=utf-8',
    headers: {
      'access-control-allow-origin': origin ?? 'http://127.0.0.1',
      'access-control-allow-credentials': 'true',
    },
    body: JSON.stringify(body),
  };
}

function preflight(origin?: string) {
  return {
    status: 204,
    headers: {
      'access-control-allow-origin': origin ?? 'http://127.0.0.1',
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'accept,content-type,idempotency-key,if-match,x-access-version,x-action-proof,x-client-version,x-contract-version,x-csrf-token,x-scope-hint,x-trace-id',
      'access-control-max-age': '600',
    },
    body: '',
  };
}
