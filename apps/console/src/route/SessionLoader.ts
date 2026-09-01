import { ApiError } from '@shop/sdk';
import type { LoaderFunctionArgs } from 'react-router';
import { redirect, redirectDocument } from 'react-router';
import { z } from 'zod';
import {
  ProfileSchema,
  ScopePageSchema,
  SessionSchema,
  uniqueScopes,
  type ConsoleContext,
  type ConsoleProfile,
  type ConsoleScope,
  type ConsoleSession,
} from '../entity/session/ConsoleSession';
import { consoleRequest, identitySessionRead, memberProfileRead, organizationLayersRead } from '../shared/api/Client';
import { appConfig } from '../shared/config/AppConfig';
import { scopePath } from '../shared/url/ScopePath';

const ScopeParametersSchema = z.object({
  scopeKind: z.enum(['platform', 'distributor', 'tenant', 'enterprise', 'mall']),
  scopeId: z.string().min(1).max(255),
});

export async function landingLoader({ request }: LoaderFunctionArgs) {
  const session = await readSession(request.signal);
  const first = session.scopes.find(isConsoleScope) ?? session.scope;
  if (!isConsoleScope(first)) throw new Response('CONSOLE_SCOPE_MISSING', { status: 403 });
  return redirect(scopePath(first, 'cockpit'));
}

export async function scopeLoader({ params, request }: LoaderFunctionArgs): Promise<ConsoleContext> {
  const parsed = ScopeParametersSchema.safeParse(params);
  if (!parsed.success) throw new Response('SCOPE_ROUTE_INVALID', { status: 404 });
  const session = await readSession(request.signal);
  const roots = session.scopes.filter(isConsoleScope);
  const [layers, profileResult] = await Promise.all([
    readLayers(session, roots, request.signal),
    readProfile(session, request.signal),
  ]);
  const scopes = uniqueScopes([...roots, ...layers]);
  const scope = scopes.find((candidate) => candidate.kind === parsed.data.scopeKind && candidate.id === parsed.data.scopeId);
  if (scope === undefined) throw new Response('SCOPE_NOT_GRANTED', { status: 403 });
  return Object.freeze({ session, profile: profileResult.profile, profileState: profileResult.state, scopes, scope });
}

async function readProfile(
  session: ConsoleSession,
  signal: AbortSignal,
): Promise<Readonly<{ profile: ConsoleProfile; state: 'ready' | 'unavailable' }>> {
  try {
    const value = await memberProfileRead({}, consoleRequest(undefined, signal, session.accessVersion));
    return Object.freeze({ profile: ProfileSchema.parse(value), state: 'ready' });
  } catch (cause) {
    if (signal.aborted || (cause instanceof ApiError && cause.status === 401)) throw cause;
    return Object.freeze({
      profile: Object.freeze({ display_name: '当前用户', employee_no: null }),
      state: 'unavailable',
    });
  }
}

async function readSession(signal: AbortSignal): Promise<ConsoleSession> {
  try {
    const value = await identitySessionRead({}, consoleRequest(undefined, signal));
    const session = SessionSchema.parse(value);
    if (session.target !== 'console') throw new Response('WRONG_CLIENT_ENTRANCE', { status: 403 });
    return session;
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) {
      throw redirectDocument(`${appConfig.authBaseUrl}/login?client=console`);
    }
    if (cause instanceof Error || cause instanceof Response) throw cause;
    throw new Error('CONSOLE_SESSION_READ_FAILED', { cause });
  }
}

async function readLayers(
  session: ConsoleSession,
  roots: readonly ConsoleScope[],
  signal: AbortSignal,
): Promise<readonly ConsoleScope[]> {
  const allowed = session.permissions.includes('organization.layer.read')
    && session.capabilities.includes('organization.layers.read');
  if (!allowed) return [];
  const pages = await Promise.all(roots.map(async (scope) => {
    const value = await organizationLayersRead(
      { query: { limit: 1000 } },
      consoleRequest(scope, signal, session.accessVersion),
    );
    return ScopePageSchema.parse(value).items.filter(isConsoleScope);
  }));
  return Object.freeze(pages.flat());
}

function isConsoleScope(scope: ConsoleScope): boolean {
  return ['platform', 'distributor', 'tenant', 'enterprise', 'mall'].includes(scope.kind);
}
