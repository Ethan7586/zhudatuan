import { NAVIGATION_CATALOG_HASH } from '../../generated/NavigationBinding';
import type { ScopeKind } from '@shop/authz';
import { NavigationTreeSchema } from './NavigationContract';
import { consoleRequest, navigationTreeRead } from '../api/Client';

const capacity = 50;
const cache = new Map<string, Readonly<{ etag: string; tree: unknown }>>();

interface NavigationSession {
  readonly actor: string;
  readonly membership: string;
  readonly accessVersion: number;
}
interface NavigationScope {
  readonly kind: ScopeKind;
  readonly id: string;
}

export async function readConsoleNavigation(session: NavigationSession, scope: NavigationScope, signal: AbortSignal) {
  const key = navigationKey(session, scope);
  const prior = cache.get(key);
  const value = await navigationTreeRead({}, consoleRequest(scope, signal, session.accessVersion, prior === undefined ? undefined : { ifNoneMatch: prior.etag, cachedResponse: prior.tree }));
  const tree = NavigationTreeSchema.parse(value);
  if (tree.catalogVersion !== NAVIGATION_CATALOG_HASH || tree.scope.id !== scope.id || tree.scope.kind !== scope.kind) {
    throw new Response('NAVIGATION_CATALOG_MISMATCH', { status: 409 });
  }
  cache.delete(key);
  cache.set(key, Object.freeze({ etag: tree.etag, tree }));
  while (cache.size > capacity) cache.delete(cache.keys().next().value!);
  return tree;
}

export function clearConsoleNavigation(): void {
  cache.clear();
}

function navigationKey(session: NavigationSession, scope: NavigationScope): string {
  return [session.actor, session.membership, scope.kind, scope.id, session.accessVersion, NAVIGATION_CATALOG_HASH].join('|');
}
