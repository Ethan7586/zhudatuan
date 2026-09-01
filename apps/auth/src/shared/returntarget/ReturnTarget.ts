import type { AuthTarget } from '@shop/config/client';

export interface AuthRequest {
  readonly target: AuthTarget;
  readonly returnTarget?: string;
  readonly returnPath?: string;
}

export function readAuthRequest(location: Pick<Location, 'search'>): AuthRequest {
  const query = new URLSearchParams(location.search);
  const target = query.get('target') === 'console' ? 'console' : 'storefront';
  const returnTarget = query.get('returntarget')?.trim();
  const returnPath = query.get('returnpath')?.trim();
  return Object.freeze({ target, ...(returnTarget ? { returnTarget } : {}), ...(!returnTarget && returnPath ? { returnPath } : {}) });
}

export function authTargetSearch(search: string, target: AuthTarget): string {
  const query = new URLSearchParams(search);
  query.set('target', target);
  query.delete('returntarget');
  query.delete('returnpath');
  return `?${query.toString()}`;
}
