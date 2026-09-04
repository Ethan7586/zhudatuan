import { compactFailure } from '@shop/presentation/compact';
import { projectRecords, type DisplayCollection } from '@shop/presentation/records';
import { ROUTE_BY_ID } from '@shop/config/route';
import { createWechatSurface, type MiniappSurfaceClient } from '@shop/sdk';
import type { OperationOutputFor } from '@shop/contract';
import { OP_IDENTITY_FEDERATIONS_CALLBACK } from '@shop/contract/ids';
import { operationPolicy } from '@shop/contract/policies';
import { readMiniappEnvironment, type MiniappRuntimeEnvironment } from '../config/Environment';
import type { RouteMatch } from '../generated/RouteBinding';
import { CookieJar } from '../platform/CookieJar';
import { createWechatRequester, wechatLogin } from '../platform/Request';
import { randomToken } from '../platform/Random';
import { MiniappCache } from './Cache';
import { miniappContext } from './Context';
import { MINIAPP_FEATURES } from './FeatureCatalog';
import { miniappNavigation, type MiniappNavigationItem } from './Navigation';

const AUTH_LINK_PATH = requiredRoutePath('authlink');
const AUTH_MEMBERSHIP_PATH = requiredRoutePath('authmembership');
const FEDERATION_CALLBACK_PATH = operationPolicy(OP_IDENTITY_FEDERATIONS_CALLBACK).path;

export interface MiniappSnapshot {
  readonly title: string;
  readonly description: string;
  readonly data: DisplayCollection;
  readonly authenticated: boolean;
  readonly stale: boolean;
  readonly navigation: readonly MiniappNavigationItem[];
}

export interface MembershipChoice {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
}

export type SignInResult = Readonly<{ kind: 'complete' }> | Readonly<{ kind: 'selection'; memberships: readonly MembershipChoice[] }>;
export interface MiniappFailureView {
  readonly message: string;
  readonly authenticationRequired: boolean;
}

export class MiniappRuntime {
  private readonly cache = new MiniappCache();
  private sessionValue: OperationOutputFor<'identity.session.read'> | undefined;
  private sessionCheckedAt = 0;
  private bootstrapValue: OperationOutputFor<'storefront.bootstrap.read'> | undefined;
  private bootstrapIdentity = '';
  private bootstrapCheckedAt = 0;

  constructor(
    private readonly environment: MiniappRuntimeEnvironment,
    private readonly client: MiniappSurfaceClient,
    private readonly cookies: CookieJar
  ) {}

  async read(route: RouteMatch, signal?: AbortSignal): Promise<MiniappSnapshot> {
    const feature = MINIAPP_FEATURES[route.id];
    const session = await this.session(signal);
    const context = await miniappContext(this.environment, session, { signal });
    const bootstrap = await this.bootstrap(session, context);
    const navigation = miniappNavigation(route.id, requiredNavigation(bootstrap));
    if (!flattenNavigation(requiredNavigation(bootstrap)).some((node) => !node.experience.disabled && node.experience.routeKey === route.id)) throw new Error('MINIAPP_ROUTE_DENIED');
    const key = JSON.stringify([this.environment.storefrontHandle, session?.scope.id ?? 'anonymous', session?.accessVersion ?? 0, route.id, route.parameters]);
    try {
      const value = route.id === 'miniapphome' ? bootstrap : await feature.read(this.client, context, route);
      this.cache.write(route.id, key, value);
      return Object.freeze({ title: feature.title, description: feature.description, data: projectRecords(value), authenticated: session !== undefined, stale: false, navigation });
    } catch (cause) {
      if (compactFailure(cause).authenticationRequired) throw cause;
      const cached = this.cache.read(route.id, key);
      if (cached === undefined) throw cause;
      return Object.freeze({ title: feature.title, description: `${feature.description} 当前为最近一次成功加载的数据。`, data: projectRecords(cached), authenticated: session !== undefined, stale: true, navigation });
    }
  }

  failure(cause: unknown): MiniappFailureView {
    const value = compactFailure(cause);
    return Object.freeze({ message: value.message, authenticationRequired: value.authenticationRequired });
  }

  async signIn(signal?: AbortSignal): Promise<SignInResult> {
    const base = await miniappContext(this.environment, undefined, { signal });
    const bootstrap = await this.client.identity.bootstrapRead({ query: { returnpath: '/' } }, base);
    if (bootstrap.target !== 'miniapp' || !bootstrap.methods.includes('federation')) throw new Error('MINIAPP_FEDERATION_UNAVAILABLE');
    const providers = await this.client.identity.providersRead({ query: { returntarget: bootstrap.returnTarget } }, base);
    const provider = providers.items.find((item) => item.type === 'wechat');
    if (provider === undefined) throw new Error('MINIAPP_WECHAT_PROVIDER_UNAVAILABLE');
    const authorization = Object.freeze({ state: await randomToken(32), nonce: await randomToken(32), challenge: await randomToken(32) });
    const started = await this.client.identity.federationsStart(
      { body: { providerid: provider.id, returntarget: bootstrap.returnTarget, authorization } },
      await miniappContext(this.environment, undefined, { signal, csrf: bootstrap.csrf, command: true })
    );
    const callback = this.callback(started.location, provider.id);
    const completed = await this.client.identity.federationsCallback({ path: { providerid: provider.id }, query: { state: callback.state, code: await wechatLogin() } }, await miniappContext(this.environment, undefined, { signal }));
    const destination = this.destination(completed.location);
    if (destination.pathname === AUTH_MEMBERSHIP_PATH) {
      const selection = await this.client.identity.federationsSelectionRead({}, await miniappContext(this.environment, undefined, { signal }));
      if (selection.target !== 'miniapp' || selection.memberships.length < 2) throw new Error('MINIAPP_MEMBERSHIP_SELECTION_INVALID');
      return Object.freeze({
        kind: 'selection',
        memberships: Object.freeze(selection.memberships.map((item) => Object.freeze({ id: item.id, title: item.displayName, detail: `${item.organizationName} · ${item.roleLabel}` }))),
      });
    }
    await this.requireSession(signal);
    this.clearBootstrap();
    return Object.freeze({ kind: 'complete' });
  }

  async selectMembership(membership: string, signal?: AbortSignal): Promise<void> {
    if (!/^[A-Za-z0-9:./-]{3,255}$/.test(membership)) throw new Error('MINIAPP_MEMBERSHIP_INVALID');
    const bootstrap = await this.client.identity.bootstrapRead({ query: { returnpath: '/' } }, await miniappContext(this.environment, undefined, { signal }));
    const completed = await this.client.identity.federationsComplete({ body: { membershipid: membership } }, await miniappContext(this.environment, undefined, { signal, csrf: bootstrap.csrf, command: true }));
    this.destination(completed.location);
    await this.requireSession(signal);
    this.clearBootstrap();
  }

  async signOut(signal?: AbortSignal): Promise<void> {
    const session = await this.session(signal);
    if (session !== undefined) await this.client.identity.sessionDelete({ body: {} }, await miniappContext(this.environment, session, { signal, csrf: session.csrf, command: true }));
    this.sessionValue = undefined;
    this.sessionCheckedAt = Date.now();
    this.cookies.clear();
    this.cache.clear();
    this.clearBootstrap();
  }

  private async session(signal?: AbortSignal): Promise<OperationOutputFor<'identity.session.read'> | undefined> {
    if (Date.now() - this.sessionCheckedAt < 30_000) return this.sessionValue;
    try {
      const value = await this.client.identity.sessionRead({}, await miniappContext(this.environment, undefined, { signal }));
      if (value.target !== 'miniapp') throw new Error('MINIAPP_SESSION_TARGET_INVALID');
      this.sessionValue = value;
    } catch (cause) {
      if (!compactFailure(cause).authenticationRequired) throw cause;
      this.sessionValue = undefined;
    }
    this.sessionCheckedAt = Date.now();
    return this.sessionValue;
  }

  private async requireSession(signal?: AbortSignal): Promise<void> {
    this.sessionCheckedAt = 0;
    if ((await this.session(signal)) === undefined) throw new Error('MINIAPP_SESSION_NOT_CREATED');
  }

  private async bootstrap(session: OperationOutputFor<'identity.session.read'> | undefined, context: Awaited<ReturnType<typeof miniappContext>>): Promise<OperationOutputFor<'storefront.bootstrap.read'>> {
    const identity = session === undefined ? 'anonymous' : `${session.actor}:${session.membership}:${session.scope.id}:${session.accessVersion}`;
    if (this.bootstrapValue !== undefined && this.bootstrapIdentity === identity && Date.now() - this.bootstrapCheckedAt < 30_000) return this.bootstrapValue;
    const value = await this.client.storefront.bootstrapRead({}, context);
    if (value.entry.handle !== this.environment.storefrontHandle || value.scope.kind !== 'mall' || value.navigation.data === null) throw new Error('MINIAPP_BOOTSTRAP_INVALID');
    this.bootstrapValue = value;
    this.bootstrapIdentity = identity;
    this.bootstrapCheckedAt = Date.now();
    return value;
  }

  private clearBootstrap(): void {
    this.bootstrapValue = undefined;
    this.bootstrapIdentity = '';
    this.bootstrapCheckedAt = 0;
  }

  private callback(location: string, provider: string): Readonly<{ state: string }> {
    const target = new URL(location);
    const expected = FEDERATION_CALLBACK_PATH.replace('{providerid}', encodeURIComponent(provider));
    const state = target.searchParams.get('state');
    if (target.origin !== this.environment.apiOrigin || target.pathname !== expected || target.searchParams.get('method') !== 'wx.login' || state === null || !/^[A-Za-z0-9._~-]{16,256}$/.test(state)) {
      throw new Error('MINIAPP_FEDERATION_CALLBACK_INVALID');
    }
    return Object.freeze({ state });
  }

  private destination(location: string): URL {
    const target = new URL(location);
    if (![this.environment.ownOrigin, this.environment.authOrigin].includes(target.origin) || target.username || target.password || target.hash) throw new Error('MINIAPP_FEDERATION_DESTINATION_INVALID');
    if (target.origin === this.environment.authOrigin && ![AUTH_MEMBERSHIP_PATH, AUTH_LINK_PATH].includes(target.pathname)) throw new Error('MINIAPP_FEDERATION_DESTINATION_INVALID');
    if (target.pathname === AUTH_LINK_PATH) throw new Error('FEDERATION_LINK_REQUIRED');
    return target;
  }
}

function requiredNavigation(value: OperationOutputFor<'storefront.bootstrap.read'>): NonNullable<OperationOutputFor<'storefront.bootstrap.read'>['navigation']['data']> {
  if (value.navigation.data === null) throw new Error('MINIAPP_NAVIGATION_MISSING');
  return value.navigation.data;
}

type BootstrapNavigationNode = ReturnType<typeof requiredNavigation>[number];

function flattenNavigation(nodes: readonly BootstrapNavigationNode[]): readonly BootstrapNavigationNode[] {
  return nodes.flatMap((node) => [node, ...flattenNavigation(node.children)]);
}

function requiredRoutePath(id: 'authlink' | 'authmembership'): string {
  const route = ROUTE_BY_ID.get(id);
  if (route === undefined || route.surface !== 'auth') throw new Error('MINIAPP_AUTH_ROUTE_MISSING');
  return route.path;
}

export function createMiniappRuntime(): MiniappRuntime {
  const environment = readMiniappEnvironment();
  const cookies = new CookieJar();
  return new MiniappRuntime(environment, createWechatSurface(environment.apiOrigin, createWechatRequester(environment.ownOrigin, cookies)), cookies);
}
