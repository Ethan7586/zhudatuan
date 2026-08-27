import { apiError, methodNotAllowed } from './http';
import type { WorkerEnv } from './types';

const IMAGE_PATH = /^\/api\/v1\/catalog\/public\/products\/([^/]+)\/image$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_SOURCE_HOSTS = new Set(['m.media-amazon.com']);
const HTTPS_PUBLIC_HOSTS = new Set(['zhudatuan.com', 'www.zhudatuan.com', 'hbbtzn.com', 'www.hbbtzn.com']);
const keyCache = new Map<string, Promise<CryptoKey>>();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function signingSecret(env: WorkerEnv): string | null {
  const secret = env.MINIAPP_SESSION_SIGNING_KEY ?? env.SESSION_SIGNING_KEY;
  return secret && secret.length >= 32 ? secret : null;
}

function signingKey(secret: string): Promise<CryptoKey> {
  const cached = keyCache.get(secret);
  if (cached) return cached;
  const created = crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  keyCache.set(secret, created);
  return created;
}

function signatureInput(productId: string, source: string): string {
  return `${productId}\n${source}`;
}

function safeSource(value: string | null): URL | null {
  if (!value || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ALLOWED_SOURCE_HOSTS.has(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

function publicMediaBase(env: WorkerEnv): URL | null {
  const value = env.PUBLIC_MEDIA_BASE_URL?.trim().replace(/\/+$/, '');
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

function isCanonicalMediaUrl(value: string, base: URL): boolean {
  try {
    const url = new URL(value);
    const prefix = base.pathname.replace(/\/+$/, '');
    return url.origin === base.origin && (!prefix || url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
  } catch {
    return false;
  }
}

function publicOrigin(request: Request): string {
  const requestUrl = new URL(request.url);
  if (HTTPS_PUBLIC_HOSTS.has(requestUrl.hostname)) return `https://${requestUrl.hostname}`;
  return requestUrl.origin;
}

export async function publicCatalogCoverUrl(request: Request, env: WorkerEnv, productId: string, coverUrl: string | null): Promise<string | null> {
  if (!coverUrl) return null;
  const mediaBase = publicMediaBase(env);
  if (mediaBase && isCanonicalMediaUrl(coverUrl, mediaBase)) return coverUrl;
  const source = safeSource(coverUrl);
  const origin = publicOrigin(request);
  if (!source) return coverUrl.startsWith(origin) ? coverUrl : null;
  const secret = signingSecret(env);
  if (!secret) return coverUrl;
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), new TextEncoder().encode(signatureInput(productId, source.href)));
  const path = `/api/v1/catalog/public/products/${encodeURIComponent(productId)}/image`;
  return `${origin}${path}?source=${encodeURIComponent(source.href)}&signature=${toBase64Url(new Uint8Array(signature))}`;
}

export async function handlePublicCatalogImage(request: Request, env: WorkerEnv, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const url = new URL(request.url);
  const match = url.pathname.match(IMAGE_PATH);
  const productId = match ? decodeURIComponent(match[1]) : '';
  const source = safeSource(url.searchParams.get('source'));
  const encodedSignature = url.searchParams.get('signature') ?? '';
  const secret = signingSecret(env);
  if (!productId || !source || !encodedSignature || !secret) return apiError(404, 'CATALOG_IMAGE_NOT_FOUND', '商品图片不存在', requestId);

  try {
    const valid = await crypto.subtle.verify('HMAC', await signingKey(secret), Uint8Array.from(fromBase64Url(encodedSignature)).buffer, new TextEncoder().encode(signatureInput(productId, source.href)));
    if (!valid) return apiError(404, 'CATALOG_IMAGE_NOT_FOUND', '商品图片不存在', requestId);
  } catch {
    return apiError(404, 'CATALOG_IMAGE_NOT_FOUND', '商品图片不存在', requestId);
  }

  let upstream: Response;
  try {
    upstream = await fetch(source, { redirect: 'manual', headers: { accept: 'image/avif,image/webp,image/*' } });
  } catch {
    return apiError(502, 'CATALOG_IMAGE_UPSTREAM_FAILED', '商品图片暂时不可用', requestId);
  }
  const contentType = upstream.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
  const declaredLength = Number(upstream.headers.get('content-length') ?? 0);
  if (!upstream.ok || !/^image\/(?:jpeg|png|webp|gif|avif)$/.test(contentType) || declaredLength > MAX_IMAGE_BYTES) {
    return apiError(502, 'CATALOG_IMAGE_UPSTREAM_FAILED', '商品图片暂时不可用', requestId);
  }
  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_IMAGE_BYTES) return apiError(502, 'CATALOG_IMAGE_TOO_LARGE', '商品图片超过大小限制', requestId);
  return new Response(body, {
    status: 200,
    headers: {
      'cache-control': 'public, max-age=604800, immutable',
      'content-length': String(body.byteLength),
      'content-type': contentType,
      'x-content-type-options': 'nosniff',
    },
  });
}

export function isPublicCatalogImagePath(pathname: string): boolean {
  return IMAGE_PATH.test(pathname);
}
