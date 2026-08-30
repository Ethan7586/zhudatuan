import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { isIP } from 'node:net';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { HttpApp } from './HttpApp';

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export function listen(app: HttpApp, port: number): Readonly<{ close: () => Promise<void> }> {
  const server = createServer(async (request, response) => {
    const controller = new AbortController();
    request.once('aborted', () => controller.abort(new Error('REQUEST_ABORTED')));
    response.once('close', () => { if (!response.writableEnded) controller.abort(new Error('REQUEST_ABORTED')); });
    try {
      await write(await app.handle(await convert(request, controller.signal)), response);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'INTERNAL_ERROR';
      response.writeHead(code === 'REQUEST_BODY_TOO_LARGE' ? 413 : 500, { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff' });
      response.end(JSON.stringify({ code: code === 'REQUEST_BODY_TOO_LARGE' ? code : 'INTERNAL_ERROR' }));
    }
  });
  server.requestTimeout = RUNTIME_LIMITS.http.totalDeadlineMilliseconds;
  server.headersTimeout = RUNTIME_LIMITS.http.headersTimeoutMilliseconds;
  server.keepAliveTimeout = RUNTIME_LIMITS.http.keepAliveTimeoutMilliseconds;
  server.maxRequestsPerSocket = RUNTIME_LIMITS.http.maximumRequestsPerSocket;
  server.listen(port, '0.0.0.0');
  return { close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
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
  return new Request(`${protocol}://${host}${request.url ?? '/'}`, { method: request.method ?? 'GET', headers, signal,
    ...(body === undefined ? {} : { body: body.toString('utf8') }) });
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
    if (size > MAX_BODY_BYTES) throw new Error('REQUEST_BODY_TOO_LARGE');
    chunks.push(value);
  }
  return chunks.length === 0 ? undefined : Buffer.concat(chunks);
}

async function write(input: Response, output: ServerResponse): Promise<void> {
  output.statusCode = input.status;
  input.headers.forEach((value, name) => { if (name !== 'set-cookie') output.setHeader(name, value); });
  const cookies = input.headers.getSetCookie();
  if (cookies.length > 0) output.setHeader('set-cookie', cookies);
  output.end(Buffer.from(await input.arrayBuffer()));
}
