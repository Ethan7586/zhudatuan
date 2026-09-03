import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { ClientError } from '@shop/sdk';
import { readAuthRequest } from '../shared/security/ReturnTarget';
import type { AuthRoute } from './Routes';

const ALLOWED: Readonly<Record<AuthRoute, ReadonlySet<string>>> = Object.freeze({
  '/': new Set(['target', 'returntarget', 'returnpath']),
  '/invitation': new Set(['target', 'returntarget', 'returnpath']),
  '/membership': new Set(['target', 'state']),
  '/callback': new Set(['target']),
  '/link': new Set(['target', 'code']),
});

export function Guard({ route, children, rejected }: Readonly<{ route: AuthRoute; children: (request: ReturnType<typeof readAuthRequest>) => ReactNode; rejected: ReactNode }>) {
  const location = useLocation();
  try {
    validate(location.search, ALLOWED[route]);
    return children(readAuthRequest({ search: location.search }));
  } catch {
    return rejected;
  }
}

function validate(search: string, allowed: ReadonlySet<string>): void {
  if (search.length > 4096) throw new ClientError('RETURN_TARGET_INVALID');
  const query = new URLSearchParams(search);
  const seen = new Set<string>();
  for (const [key, value] of query) {
    if (!allowed.has(key) || seen.has(key) || key.length > 32 || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) throw new ClientError('RETURN_TARGET_INVALID');
    seen.add(key);
  }
  const target = query.get('target');
  if (target !== null && target !== 'console' && target !== 'storefront') throw new ClientError('RETURN_TARGET_INVALID');
}
