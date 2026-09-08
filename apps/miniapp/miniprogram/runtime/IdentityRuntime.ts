import { compactFailure } from '@shop/presentation/compact';
import { ROUTE_BY_ID } from '@shop/config/route';
import type { OperationOutputFor } from '@shop/contract';
import { OP_IDENTITY_FEDERATIONS_CALLBACK } from '@shop/contract/ids';
import { operationPolicy } from '@shop/contract/policies';
import type { MiniappRuntimeEnvironment } from '../config/Environment';
import type { CookieJar } from '../platform/CookieJar';
import { wechatLogin } from '../platform/Request';
import { randomToken } from '../platform/Random';
import { miniappContext } from './Context';
import type { MiniappCoreClient } from './CoreClient';

const AUTH_LINK_PATH = requiredRoutePath('authlink');
const AUTH_MEMBERSHIP_PATH = requiredRoutePath('authmembership');
const FEDERATION_CALLBACK_PATH = operationPolicy(OP_IDENTITY_FEDERATIONS_CALLBACK).path;

export interface MembershipChoice {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
}

export type SignInResult = Readonly<{ kind: 'complete' }> | Readonly<{ kind: 'selection'; memberships: readonly MembershipChoice[] }>;
export type MiniappSession = OperationOutputFor<'identity.session.read'>;

export class IdentityRuntime {
  private value: MiniappSession | undefined;
  private checkedAt = 0;

  constructor(
    private readonly environment: MiniappRuntimeEnvironment,
    private readonly client: MiniappCoreClient['identity'],
    private readonly cookies: CookieJar
  ) {}

  current(): MiniappSession | undefined {
    return this.value;
  }

  async session(signal?: AbortSignal): Promise<MiniappSession | undefined> {
    if (Date.now() - this.checkedAt < 30_000) return this.value;
    try {
      const value = await this.client.sessionRead({}, await miniappContext(this.environment, undefined, { signal }));
      if (value.target !== 'miniapp') throw new Error('MINIAPP_SESSION_TARGET_INVALID');
      this.value = value;
    } catch (cause) {
      if (!compactFailure(cause).authenticationRequired) throw cause;
      this.value = undefined;
    }
    this.checkedAt = Date.now();
    return this.value;
  }

  async require(signal?: AbortSignal): Promise<MiniappSession> {
    this.checkedAt = 0;
    const session = await this.session(signal);
    if (session === undefined) throw new Error('MINIAPP_SESSION_NOT_CREATED');
    return session;
  }

  async signIn(signal?: AbortSignal): Promise<SignInResult> {
    const base = await miniappContext(this.environment, undefined, { signal });
    const bootstrap = await this.client.bootstrapRead({ query: { returnpath: '/' } }, base);
    if (bootstrap.target !== 'miniapp' || !bootstrap.methods.includes('federation')) throw new Error('MINIAPP_FEDERATION_UNAVAILABLE');
    const providers = await this.client.providersRead({ query: { returntarget: bootstrap.returnTarget } }, base);
    const provider = providers.items.find((item) => item.type === 'wechat');
    if (provider === undefined) throw new Error('MINIAPP_WECHAT_PROVIDER_UNAVAILABLE');
    const authorization = Object.freeze({ state: await randomToken(32), nonce: await randomToken(32), challenge: await randomToken(32) });
    const started = await this.client.federationsStart(
      { body: { providerid: provider.id, returntarget: bootstrap.returnTarget, authorization } },
      await miniappContext(this.environment, undefined, { signal, csrf: bootstrap.csrf, command: true })
    );
    const callback = this.callback(started.location, provider.id);
    const completed = await this.client.federationsCallback(
      { path: { providerid: provider.id }, query: { state: callback.state, code: await wechatLogin() } },
      await miniappContext(this.environment, undefined, { signal })
    );
    const destination = this.destination(completed.location);
    if (destination.pathname !== AUTH_MEMBERSHIP_PATH) {
      await this.require(signal);
      return Object.freeze({ kind: 'complete' });
    }
    const selection = await this.client.federationsSelectionRead({}, await miniappContext(this.environment, undefined, { signal }));
    if (selection.target !== 'miniapp' || selection.memberships.length < 2) throw new Error('MINIAPP_MEMBERSHIP_SELECTION_INVALID');
    return Object.freeze({
      kind: 'selection',
      memberships: Object.freeze(selection.memberships.map((item) => Object.freeze({ id: item.id, title: item.displayName, detail: `${item.organizationName} · ${item.roleLabel}` }))),
    });
  }

  async selectMembership(membership: string, signal?: AbortSignal): Promise<void> {
    if (!/^[A-Za-z0-9:./-]{3,255}$/.test(membership)) throw new Error('MINIAPP_MEMBERSHIP_INVALID');
    const bootstrap = await this.client.bootstrapRead({ query: { returnpath: '/' } }, await miniappContext(this.environment, undefined, { signal }));
    const completed = await this.client.federationsComplete(
      { body: { membershipid: membership } },
      await miniappContext(this.environment, undefined, { signal, csrf: bootstrap.csrf, command: true })
    );
    this.destination(completed.location);
    await this.require(signal);
  }

  async signOut(signal?: AbortSignal): Promise<void> {
    const session = await this.session(signal);
    if (session !== undefined) await this.client.sessionDelete({ body: {} }, await miniappContext(this.environment, session, { signal, csrf: session.csrf, command: true }));
    this.value = undefined;
    this.checkedAt = Date.now();
    this.cookies.clear();
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

function requiredRoutePath(id: 'authlink' | 'authmembership'): string {
  const route = ROUTE_BY_ID.get(id);
  if (route === undefined || route.surface !== 'auth') throw new Error('MINIAPP_AUTH_ROUTE_MISSING');
  return route.path;
}
