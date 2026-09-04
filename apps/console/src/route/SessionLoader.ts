import { OP_ORGANIZATION_LAYERS_READ } from '@shop/contract/ids';
import { PERM_ORGANIZATION_LAYER_READ } from '@shop/authz/ids';
import { hasFailureCode } from '@shop/presentation';
import { isConsoleScopeKind } from '@shop/authz';
import { mapConcurrent } from '@shop/kernel';
import type { LoaderFunctionArgs } from 'react-router';
import { redirect, redirectDocument } from 'react-router';
import { ProfileSchema, ScopePageSchema, SessionSchema, uniqueScopes, type ConsoleContext, type ConsoleScope, type ConsoleSession } from '../entity/session/ConsoleSession';
import type { SessionPort } from '../entity/session/public/SessionPort';
import { collectPages } from '../shared/api/Pager';
import type { RouteRegistryContract } from '../shared/manifest/ComponentManifest';
import { readConsoleNavigation } from '../shared/navigation/NavigationQuery';
import { consoleAuthUrl } from '../shared/url/AuthUrl';
import { guardRoute, landingPath } from './RouteGuard';
import { ScopeParametersSchema } from './ScopeParameters';
export function createSessionLoaders(registry: RouteRegistryContract, port: SessionPort) {
  const landingLoader = async ({ request }: LoaderFunctionArgs) => {
    const session = await readSession(port, request.signal);
    const first = session.scopes.find(isConsoleScope) ?? session.scope;
    if (!isConsoleScope(first)) throw new Response('CONSOLE_SCOPE_MISSING', { status: 403 });
    const navigation = await readConsoleNavigation(session, first, request.signal);
    return redirect(landingPath(navigation.nodes, first, registry));
  };
  const scopeLoader = async ({ params, request }: LoaderFunctionArgs): Promise<ConsoleContext | Response> => {
    const parsed = ScopeParametersSchema.safeParse(params);
    if (!parsed.success) throw new Response('SCOPE_ROUTE_INVALID', { status: 404 });
    const session = await readSession(port, request.signal);
    const roots = session.scopes.filter(isConsoleScope);
    const requested = (candidate: ConsoleScope) => candidate.kind === parsed.data.scopeKind && candidate.id === parsed.data.scopeId;
    const rootScope = roots.find(requested);
    const layersPromise = readLayers(port, session, roots, request.signal);
    const profilePromise = port.profile(session.accessVersion, request.signal);
    const navigationPromise = rootScope === undefined ? undefined : readConsoleNavigation(session, rootScope, request.signal);
    const [layers, profileValue, rootNavigation] = await Promise.all([layersPromise, profilePromise, navigationPromise ?? Promise.resolve(undefined)]);
    const scopes = uniqueScopes([...roots, ...layers]);
    const scope = scopes.find(requested);
    if (scope === undefined) throw new Response('SCOPE_NOT_GRANTED', { status: 403 });
    const profile = ProfileSchema.parse(profileValue);
    const navigation = rootNavigation ?? (await readConsoleNavigation(session, scope, request.signal));
    const guarded = guardRoute(new URL(request.url).pathname, navigation.nodes, scope, registry);
    if (guarded !== undefined) return guarded;
    return Object.freeze({ session, profile, scopes, scope, navigation });
  };
  return Object.freeze({ landingLoader, scopeLoader });
}
async function readSession(port: SessionPort, signal: AbortSignal): Promise<ConsoleSession> {
  try {
    const value = await port.read(signal);
    const session = SessionSchema.parse(value);
    if (session.target !== 'console') throw new Response('WRONG_CLIENT_ENTRANCE', { status: 403 });
    return session;
  } catch (cause) {
    if (hasFailureCode(cause, 'AUTHENTICATION_REQUIRED')) {
      throw redirectDocument(consoleAuthUrl());
    }
    if (cause instanceof Error || cause instanceof Response) throw cause;
    throw new Error('CONSOLE_SESSION_READ_FAILED', { cause });
  }
}

async function readLayers(port: SessionPort, session: ConsoleSession, roots: readonly ConsoleScope[], signal: AbortSignal): Promise<readonly ConsoleScope[]> {
  const allowed = session.permissions.includes(PERM_ORGANIZATION_LAYER_READ) && session.capabilities.includes(OP_ORGANIZATION_LAYERS_READ);
  if (!allowed) return [];
  const pages = await mapConcurrent(roots, 4, async (scope) =>
    collectPages(async (cursor) => {
      const value = await port.layers(scope, session.accessVersion, cursor, signal);
      const page = ScopePageSchema.parse(value);
      return Object.freeze({ items: page.items.filter(isConsoleScope), ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
    })
  );
  return Object.freeze(pages.flat());
}

function isConsoleScope(scope: ConsoleSession['scope']): scope is ConsoleScope {
  return isConsoleScopeKind(scope.kind);
}
