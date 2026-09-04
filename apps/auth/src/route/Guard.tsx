import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { readSessionRequest } from '../shared/security/ReturnTarget';
import { ROUTES, type RoutePath as AuthRoute } from '../generated/RouteBinding';
import { hasControlCharacter } from '../shared/security/TextSafety';
import { isOperationTarget } from '@shop/contract';

const ALLOWED: Readonly<Record<AuthRoute, ReadonlySet<string>>> = Object.freeze({
  [ROUTES.authlogin]: new Set(['target', 'returntarget', 'returnpath']),
  [ROUTES.authinvitation]: new Set(['target', 'returntarget', 'returnpath']),
  [ROUTES.authmembership]: new Set(['target', 'state']),
  [ROUTES.authlink]: new Set(['target', 'code']),
});

export function Guard({ route, children, rejected }: Readonly<{ route: AuthRoute; children: (request: ReturnType<typeof readSessionRequest>) => ReactNode; rejected: ReactNode }>) {
  const location = useLocation();
  try {
    validate(location.search, ALLOWED[route]);
    return children(readSessionRequest({ search: location.search }));
  } catch {
    return rejected;
  }
}

function validate(search: string, allowed: ReadonlySet<string>): void {
  if (search.length > 4096) throw new Error('RETURN_TARGET_INVALID');
  const query = new URLSearchParams(search);
  const seen = new Set<string>();
  for (const [key, value] of query) {
    if (!allowed.has(key) || seen.has(key) || key.length > 32 || value.length > 2048 || hasControlCharacter(value)) throw new Error('RETURN_TARGET_INVALID');
    seen.add(key);
  }
  const target = query.get('target');
  if (target !== null && !isOperationTarget(target)) throw new Error('RETURN_TARGET_INVALID');
  const code = query.get('code');
  if (code !== null && code !== 'FEDERATION_LINK_REQUIRED') throw new Error('RETURN_TARGET_INVALID');
}
