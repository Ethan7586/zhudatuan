import { DomainError } from '../domain/DomainError';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { isIP } from 'node:net';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { HttpApp } from './HttpApp';
import { ErrorMapper } from './ErrorMapper';

export function listen(app: HttpApp, port: number, host: '127.0.0.1' | '0.0.0.0' = '127.0.0.1'): Readonly<{ close: () => Promise<void> }> {
  const server = createServer(async (request, response) => {
    const controller = new AbortController();
    request.once('aborted', () => controller.abort(new Error('REQUEST_ABORTED')));
    response.once('close', () => {
      if (!response.writableEnded) controller.abort(new Error('REQUEST_ABORTED'));
    });
    try {
      await writeResponse(await app.handle(await convert(request, controller.signal)), response);
    } catch (cause) {
      const supplied = request.headers['x-request-id'];
      const requestId = typeof supplied === 'string' && supplied.length <= 128 ? supplied : 'request:missing';
      const mapped = new ErrorMapper().map(cause, requestId);
      response.writeHead(mapped.status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      response.end(JSON.stringify(mapped.body));
    }
  });
  server.requestTimeout = RUNTIME_LIMITS.http.totalDeadlineMilliseconds;
  server.headersTimeout = RUNTIME_LIMITS.http.headersTimeoutMilliseconds;
  server.keepAliveTimeout = RUNTIME_LIMITS.http.keepAliveTimeoutMilliseconds;
  server.maxRequestsPerSocket = RUNTIME_LIMITS.http.maximumRequestsPerSocket;
  server.listen(port, host);
  return { close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))) };
}

async function convert(request: IncomingMessage, signal: AbortSignal): Promise<Request> {
  const host = request.headers.host;
  if (!host) throw new Error('REQUEST_HOST_MISSING');
  const protocol = request.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  headers.set('x-peer-address', trustedPeerAddress(request.headers['x-real-ip'], request.socket.remoteAddress));
  const body = await read(request);
  return new Request(`${protocol}://${host}${request.url ?? '/'}`, { method: request.method ?? 'GET', headers, signal, ...(body === undefined ? {} : { body: body.toString('utf8') }) });
}

export function trustedPeerAddress(forwarded: string | string[] | undefined, remoteAddress: string | undefined): string {
  const peer = remoteAddress ?? 'unknown';
  const local = peer === '127.0.0.1' || peer === '::1' || peer === '::ffff:127.0.0.1';
  const candidate = Array.isArray(forwarded) ? undefined : forwarded?.trim();
  return local && candidate !== undefined && isIP(candidate) !== 0 ? candidate : peer;
}

async function read(request: IncomingMessage): Promise<Buffer | undefined> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += value.byteLength;
    if (size > RUNTIME_LIMITS.http.maximumBodyBytes) throw new DomainError('REQUEST_BODY_TOO_LARGE');
    chunks.push(value);
  }
  return chunks.length === 0 ? undefined : Buffer.concat(chunks);
}

export async function writeResponse(input: Response, output: ServerResponse): Promise<void> {
  output.statusCode = input.status;
  input.headers.forEach((value, name) => {
    if (name !== 'set-cookie') output.setHeader(name, value);
  });
  const cookies = input.headers.getSetCookie();
  if (cookies.length > 0) output.setHeader('set-cookie', cookies);
  if (!input.body) {
    output.end();
    return;
  }
  const reader = input.body.getReader();
  let completed = false;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      if (!output.write(Buffer.from(item.value))) await drain(output);
    }
    completed = true;
    output.end();
  } finally {
    if (!completed) await reader.cancel(new Error('REQUEST_ABORTED')).catch(() => undefined);
    reader.releaseLock();
  }
}

function drain(output: ServerResponse): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const failed = (cause: Error) => { cleanup(); reject(cause); };
    const closed = () => failed(new Error('REQUEST_ABORTED'));
    const cleanup = () => { output.off('drain', done); output.off('error', failed); output.off('close', closed); };
    output.once('drain', done);
    output.once('error', failed);
    output.once('close', closed);
  });
}
