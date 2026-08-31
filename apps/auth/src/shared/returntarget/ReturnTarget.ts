import type { AuthTarget } from '@shop/config/client';

export interface AuthRequest {
  readonly target: AuthTarget;
  readonly handle?: string;
}

export function readAuthRequest(location: Pick<Location, 'search'>): AuthRequest {
  const query = new URLSearchParams(location.search);
  const target = query.get('target') === 'console' ? 'console' : 'storefront';
  const handle = query.get('returntarget')?.trim();
  return Object.freeze({ target, ...(handle ? { handle } : {}) });
}

export function authTargetSearch(search: string, target: AuthTarget): string {
  const query = new URLSearchParams(search);
  query.set('target', target);
  query.delete('returntarget');
  return `?${query.toString()}`;
}
