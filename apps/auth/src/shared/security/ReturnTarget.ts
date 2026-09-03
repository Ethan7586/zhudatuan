import type { AuthTarget } from '@shop/config/client';
import { ClientError } from '@shop/sdk';

export interface AuthRequest {
  readonly target: AuthTarget;
  readonly returnTarget?: string;
  readonly returnPath?: string;
}

export function readAuthRequest(location: Pick<Location, 'search'>): AuthRequest {
  const query = new URLSearchParams(location.search);
  const targetValue = single(query, 'target');
  const target = targetValue === 'console' ? 'console' : 'storefront';
  const returnTarget = safeValue(single(query, 'returntarget'));
  const returnPath = safePath(single(query, 'returnpath'));
  return Object.freeze({ target, ...(returnTarget ? { returnTarget } : {}), ...(!returnTarget && returnPath ? { returnPath } : {}) });
}

export function authTargetSearch(search: string, target: AuthTarget): string {
  const query = new URLSearchParams(search);
  query.set('target', target);
  query.delete('returntarget');
  query.delete('returnpath');
  return `?${query.toString()}`;
}

export function approvedDestination(value: string, target: AuthTarget, origins: Readonly<{ console: string; storefront: string }>): string {
  let destination: URL;
  try {
    destination = new URL(value);
  } catch (cause) {
    throw new ClientError('RETURN_TARGET_INVALID', undefined, { cause });
  }
  const local = destination.protocol === 'http:' && (destination.hostname === '127.0.0.1' || destination.hostname === 'localhost' || destination.hostname === '[::1]');
  if ((!local && destination.protocol !== 'https:') || destination.origin !== origins[target] || destination.username || destination.password || destination.hash) throw new ClientError('RETURN_TARGET_INVALID');
  return destination.toString();
}

function single(query: URLSearchParams, key: string): string | undefined {
  const values = query.getAll(key);
  if (values.length > 1) throw new ClientError('RETURN_TARGET_INVALID');
  return values[0];
}

function safeValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized.length > 2048 || /[\u0000-\u001f\u007f]/.test(normalized)) throw new ClientError('RETURN_TARGET_INVALID');
  return normalized;
}

function safePath(value: string | undefined): string | undefined {
  const normalized = safeValue(value);
  if (!normalized) return undefined;
  if (!normalized.startsWith('/') || normalized.startsWith('//') || normalized.includes('\\')) throw new ClientError('RETURN_TARGET_INVALID');
  return normalized;
}
