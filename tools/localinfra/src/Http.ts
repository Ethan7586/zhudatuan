import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, type Server as HttpsServer } from 'node:https';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';

export interface LocalRequest {
  readonly body: Uint8Array;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: string;
  readonly url: URL;
}

export interface LocalResponse {
  readonly body?: Uint8Array;
  readonly headers?: Readonly<Record<string, string>>;
  readonly status: number;
}

export type LocalHandler = (request: LocalRequest) => Promise<LocalResponse>;
export type LocalPreflight = (request: Omit<LocalRequest, 'body'>) => void;

export interface LocalTls {
  readonly certificateFile: string;
  readonly keyFile: string;
}

export type LocalBindHost = '127.0.0.1' | '0.0.0.0';

export class LocalHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code);
    this.name = 'LocalHttpError';
  }
}

export async function startLocalHttps(
  name: string,
  port: number,
  handler: LocalHandler,
  tls: LocalTls,
  maximumBodyBytes = 9 * 1024 * 1024,
  preflight?: LocalPreflight,
  host: LocalBindHost = '127.0.0.1'
): Promise<HttpsServer> {
  if (!/^[a-z][a-z0-9]{2,31}$/.test(name) || !Number.isSafeInteger(port) || port < 1024 || port > 65_535) {
    throw new Error('LOCAL_HTTPS_CONFIGURATION_INVALID');
  }
  const server = createServer({ key: await readFile(tls.keyFile), cert: await readFile(tls.certificateFile) }, (request, response) => {
    void dispatch(request, response, handler, maximumBodyBytes, preflight);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  process.stdout.write(`${name.toUpperCase()}_READY https://${host}:${port}\n`);
  return server;
}

export function jsonResponse(status: number, value: unknown): LocalResponse {
  return Object.freeze({
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: new TextEncoder().encode(JSON.stringify(value)),
  });
}

export function bytesResponse(status: number, body: Uint8Array, contentType: string): LocalResponse {
  return Object.freeze({ status, headers: { 'content-type': contentType }, body });
}

export function jsonBody(request: LocalRequest): Readonly<Record<string, unknown>> {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    throw new LocalHttpError(415, 'CONTENT_TYPE_UNSUPPORTED');
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(request.body));
  } catch {
    throw new LocalHttpError(400, 'JSON_INVALID');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new LocalHttpError(400, 'JSON_OBJECT_REQUIRED');
  return value as Readonly<Record<string, unknown>>;
}

export function equalSecret(actual: string | undefined, expected: string): boolean {
  const left = createHash('sha256')
    .update(actual ?? '')
    .digest();
  const right = createHash('sha256').update(expected).digest();
  return timingSafeEqual(left, right) && actual !== undefined;
}

export function requireBearerAuthorization(headers: Readonly<Record<string, string>>, expected: string): void {
  const authorization = headers.authorization;
  const actual = authorization?.slice(0, 7).toLowerCase() === 'bearer ' ? authorization.slice(7) : undefined;
  if (!equalSecret(actual, expected)) throw new LocalHttpError(401, 'WORKLOAD_AUTHENTICATION_REQUIRED');
}

export function workloadBearerPreflight(expected: string): LocalPreflight {
  return (request) => {
    if (request.url.pathname !== '/health/ready') requireBearerAuthorization(request.headers, expected);
  };
}

export function canonicalRecord(value: unknown): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new LocalHttpError(400, 'CONTEXT_INVALID');
  const entries = Object.entries(value as Readonly<Record<string, unknown>>).sort(([left], [right]) => left.localeCompare(right));
  if (entries.some(([key, item]) => !/^[A-Za-z0-9_.:-]{1,80}$/.test(key) || typeof item !== 'string' || item.length > 512)) {
    throw new LocalHttpError(400, 'CONTEXT_INVALID');
  }
  return JSON.stringify(Object.fromEntries(entries));
}

async function dispatch(request: IncomingMessage, response: ServerResponse, handler: LocalHandler, maximumBodyBytes: number, preflight?: LocalPreflight): Promise<void> {
  try {
    const metadata = {
      headers: normalizeHeaders(request.headers),
      method: request.method ?? 'GET',
      url: new URL(request.url ?? '/', 'https://127.0.0.1'),
    };
    preflight?.(metadata);
    const body = await readBody(request, maximumBodyBytes);
    const result = await handler({
      body,
      ...metadata,
    });
    response.writeHead(result.status, {
      'cache-control': 'no-store',
      'content-length': String(result.body?.byteLength ?? 0),
      'x-content-type-options': 'nosniff',
      ...result.headers,
    });
    response.end(result.body);
  } catch (cause) {
    const error = cause instanceof LocalHttpError ? cause : new LocalHttpError(500, 'LOCAL_SERVICE_FAILED');
    const body = new TextEncoder().encode(JSON.stringify({ code: error.code }));
    response.writeHead(error.status, {
      'cache-control': 'no-store',
      'content-length': String(body.byteLength),
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
    });
    response.end(body);
  }
}

async function readBody(request: IncomingMessage, maximum: number): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > maximum) throw new LocalHttpError(413, 'REQUEST_BODY_TOO_LARGE');
    chunks.push(bytes);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

function normalizeHeaders(headers: IncomingHttpHeaders): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(headers).flatMap(([name, value]) => {
        if (value === undefined) return [];
        return [[name.toLowerCase(), Array.isArray(value) ? value.join(',') : value]];
      })
    )
  );
}
