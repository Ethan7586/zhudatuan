import type { WorkerEnv } from './types';

interface SharedCacheEnvelope<T> {
  schemaVersion: 2;
  projectionVersion: string;
  sourceCursor: string | null;
  contentHash: string;
  generatedAt: string;
  storedAt: number;
  expiresAt: number;
  staleUntil: number;
  data: T;
}

interface SharedCacheResponse<T> {
  cache: 'fresh' | 'stale';
  envelope: SharedCacheEnvelope<T>;
}

export interface CoreProjectionMetadata {
  projectionVersion: string;
  sourceCursor: string | null;
  contentHash: string;
  generatedAt: string;
}

export type CoreReadResult<T> = { status: 'disabled' | 'miss' | 'unavailable' } | ({ status: 'fresh' | 'stale'; data: T; storedAt: number } & CoreProjectionMetadata);

const READ_TIMEOUT_MS = 60;
const WRITE_TIMEOUT_MS = 250;

export async function readCoreProjection<T>(env: WorkerEnv, key: string): Promise<CoreReadResult<T>> {
  const endpoint = cacheEndpoint(env, key);
  if (!endpoint) return { status: 'disabled' };
  try {
    const response = await fetch(endpoint, {
      headers: { authorization: `Bearer ${env.CORE_READ_CACHE_TOKEN}` },
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    });
    if (response.status === 404) return { status: 'miss' };
    if (!response.ok) return { status: 'unavailable' };
    const body = (await response.json()) as SharedCacheResponse<T>;
    if (!validResponse(body)) return { status: 'unavailable' };
    return {
      status: body.cache,
      data: body.envelope.data,
      storedAt: body.envelope.storedAt,
      projectionVersion: body.envelope.projectionVersion,
      sourceCursor: body.envelope.sourceCursor,
      contentHash: body.envelope.contentHash,
      generatedAt: body.envelope.generatedAt,
    };
  } catch {
    return { status: 'unavailable' };
  }
}

export async function writeCoreProjection<T>(env: WorkerEnv, key: string, data: T, freshSeconds: number, staleSeconds: number, metadata: CoreProjectionMetadata): Promise<boolean> {
  const endpoint = cacheEndpoint(env, key);
  if (!endpoint) return false;
  try {
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${env.CORE_READ_CACHE_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ data, freshSeconds, staleSeconds, ...metadata }),
      signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function cacheEndpoint(env: WorkerEnv, key: string): string | null {
  const raw = env.CORE_READ_CACHE_URL?.trim();
  if (!raw || !env.CORE_READ_CACHE_TOKEN || !/^sw:v[12]:[a-z0-9:_-]{1,240}$/.test(key)) return null;
  try {
    const url = new URL(raw);
    const loopback = url.hostname === '127.0.0.1' || url.hostname === '::1' || url.hostname === 'localhost';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) return null;
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/v1/entries/${encodeURIComponent(key)}`;
    url.search = '';
    return url.toString();
  } catch {
    return null;
  }
}

function validResponse<T>(value: SharedCacheResponse<T>): boolean {
  const envelope = value?.envelope;
  return (
    Boolean(value && (value.cache === 'fresh' || value.cache === 'stale')) &&
    envelope?.schemaVersion === 2 &&
    typeof envelope.projectionVersion === 'string' &&
    (envelope.sourceCursor === null || typeof envelope.sourceCursor === 'string') &&
    /^sha256:[a-f0-9]{64}$/.test(envelope.contentHash) &&
    Number.isFinite(Date.parse(envelope.generatedAt)) &&
    Number.isFinite(envelope.storedAt) &&
    envelope.data !== undefined
  );
}
