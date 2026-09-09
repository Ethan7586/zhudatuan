import { compactFailure } from '@shop/presentation/compact';
import { projectRecords, type DisplayCollection } from '@shop/presentation/records';
import type { OperationExecutor } from '@shop/sdk';
import type { RequestContext } from '@shop/sdk';
import type { OperationOutputFor } from '@shop/contract';
import { readMiniappEnvironment, type MiniappRuntimeEnvironment } from '../config/Environment';
import type { RouteMatch } from '../generated/RouteBinding';
import { CookieJar } from '../platform/CookieJar';
import { copyText } from '../platform/Clipboard';
import { requestWechatPayment } from '../platform/Payment';
import { PrivacyBridge } from '../platform/Privacy';
import { MiniappCache } from './Cache';
import { miniappContext } from './Context';
import { miniappNavigation, type MiniappNavigationItem } from './Navigation';
import type { MiniappAction, MiniappActionInput, MiniappCommandResult } from '@shop/presentation/actions';
import { validateActionInput } from '@shop/presentation/actions';
import type { MiniappFeatureViewModel } from '../shared/FeatureViewModel';
import { createMiniappCore, type MiniappCoreClient } from './CoreClient';
import { IdentityRuntime, type SignInResult } from './IdentityRuntime';
import type { AuthorizedRuntime } from './AuthorizedRuntime';

export type { MembershipChoice, SignInResult } from './IdentityRuntime';

export interface MiniappSnapshot {
  readonly title: string;
  readonly description: string;
  readonly data: DisplayCollection;
  readonly authenticated: boolean;
  readonly stale: boolean;
  readonly actions: readonly MiniappAction[];
  readonly navigation: readonly MiniappNavigationItem[];
}

export interface MiniappFailureView {
  readonly message: string;
  readonly authenticationRequired: boolean;
  readonly state: 'error' | 'forbidden' | 'expired';
}

export interface MiniappCommandOutcome extends MiniappCommandResult {
  readonly snapshot?: MiniappSnapshot;
}

export class MiniappRuntime implements AuthorizedRuntime {
  private readonly cache = new MiniappCache();
  private readonly privacy = new PrivacyBridge();
  private readonly values = new Map<string, unknown>();
  private readonly identity: IdentityRuntime;
  private bootstrapValue: OperationOutputFor<'storefront.bootstrap.read'> | undefined;
  private bootstrapIdentity = '';
  private bootstrapCheckedAt = 0;

  constructor(
    private readonly environment: MiniappRuntimeEnvironment,
    private readonly client: MiniappCoreClient,
    private readonly executor: OperationExecutor,
    private readonly cookies: CookieJar
  ) {
    this.identity = new IdentityRuntime(environment, client.identity, cookies);
  }

  async read(feature: MiniappFeatureViewModel, route: RouteMatch, signal?: AbortSignal): Promise<MiniappSnapshot> {
    const session = await this.identity.session(signal);
    const context = await miniappContext(this.environment, session, { signal });
    const bootstrap = await this.bootstrap(session, context);
    const navigation = miniappNavigation(route.id, requiredNavigation(bootstrap));
    if (!flattenNavigation(requiredNavigation(bootstrap)).some((node) => !node.experience.disabled && node.experience.routeKey === route.id)) throw new Error('MINIAPP_ROUTE_DENIED');
    const key = JSON.stringify([this.environment.storefrontHandle, session?.scope.id ?? 'anonymous', session?.accessVersion ?? 0, route.id, route.parameters]);
    this.values.delete(key);
    try {
      const value = feature.bootstrap === true ? bootstrap : await requiredReader(feature)(feature.connect(this.executor), context, route);
      this.values.set(key, value);
      this.cache.write(route.id, key, value);
      return this.snapshot(feature, route, value, session !== undefined, false, navigation);
    } catch (cause) {
      if (compactFailure(cause).authenticationRequired) throw cause;
      const cached = this.cache.read(route.id, key);
      if (cached === undefined) throw cause;
      return this.snapshot(feature, route, cached, session !== undefined, true, navigation);
    }
  }

  async command(feature: MiniappFeatureViewModel, route: RouteMatch, actionId: string, input: MiniappActionInput, signal?: AbortSignal): Promise<MiniappCommandOutcome> {
    const session = await this.identity.require(signal);
    const key = this.valueKey(session, route);
    const value = this.values.get(key);
    if (value === undefined) throw new Error('MINIAPP_ACTION_SNAPSHOT_REQUIRED');
    const action = feature.actions?.(value, route).find(({ id }) => id === actionId);
    if (action === undefined || feature.execute === undefined) throw new Error('MINIAPP_ACTION_UNAVAILABLE');
    await this.privacy.ensure();
    const context = await miniappContext(this.environment, session, {
      signal,
      csrf: session.csrf,
      command: true,
      expectedVersion: action.expectedVersion,
      includeScope: action.identityScope !== true,
    });
    const result = await feature.execute(feature.connect(this.executor), context, route, value, action, validateActionInput(action, input));
    if (result.payment !== undefined) await requestWechatPayment(result.payment);
    if (result.clipboard !== undefined) await copyText(result.clipboard);
    this.cache.clear();
    this.values.clear();
    this.clearBootstrap();
    if (result.destination !== undefined) return Object.freeze(result);
    return Object.freeze({ ...result, snapshot: await this.read(feature, route, signal) });
  }

  destination(feature: MiniappFeatureViewModel, route: RouteMatch, record: string): string | undefined {
    const session = this.identity.current();
    const key = this.valueKey(session, route);
    const value = this.values.get(key);
    if (value === undefined) return undefined;
    return feature.destination?.(value, route, record);
  }

  failure(cause: unknown): MiniappFailureView {
    const value = compactFailure(cause);
    return Object.freeze({ message: value.message, authenticationRequired: value.authenticationRequired, state: value.state });
  }

  async signIn(signal?: AbortSignal): Promise<SignInResult> {
    await this.privacy.ensure();
    const result = await this.identity.signIn(signal);
    this.clearBootstrap();
    return result;
  }

  async selectMembership(membership: string, signal?: AbortSignal): Promise<void> {
    await this.identity.selectMembership(membership, signal);
    this.clearBootstrap();
  }

  async signOut(signal?: AbortSignal): Promise<void> {
    await this.identity.signOut(signal);
    this.cache.clear();
    this.clearBootstrap();
  }

  async authorizedRead<T>(
    run: (executor: OperationExecutor, context: RequestContext) => Promise<T>,
    options: Readonly<{ signal?: AbortSignal; includeScope?: boolean }> = {}
  ): Promise<T> {
    const session = await this.identity.require(options.signal);
    return run(this.executor, await miniappContext(this.environment, session, { signal: options.signal, includeScope: options.includeScope }));
  }

  async authorizedWrite<T>(
    run: (executor: OperationExecutor, context: RequestContext) => Promise<T>,
    options: Readonly<{ idempotencyKey: string; signal?: AbortSignal; expectedVersion?: number; includeScope?: boolean }>
  ): Promise<T> {
    const session = await this.identity.require(options.signal);
    await this.privacy.ensure();
    return run(
      this.executor,
      await miniappContext(this.environment, session, {
        signal: options.signal,
        csrf: session.csrf,
        command: true,
        idempotencyKey: options.idempotencyKey,
        expectedVersion: options.expectedVersion,
        includeScope: options.includeScope,
      })
    );
  }

  private snapshot(
    feature: MiniappFeatureViewModel,
    route: RouteMatch,
    value: unknown,
    authenticated: boolean,
    stale: boolean,
    navigation: readonly MiniappNavigationItem[]
  ): MiniappSnapshot {
    return Object.freeze({
      title: feature.title,
      description: stale ? `${feature.description} 当前为最近一次成功加载的数据。` : feature.description,
      data: projectRecords(feature.project?.(value, route) ?? value),
      authenticated,
      stale,
      actions: stale ? Object.freeze([]) : Object.freeze([...(feature.actions?.(value, route) ?? [])]),
      navigation,
    });
  }

  private valueKey(session: OperationOutputFor<'identity.session.read'> | undefined, route: RouteMatch): string {
    return JSON.stringify([this.environment.storefrontHandle, session?.scope.id ?? 'anonymous', session?.accessVersion ?? 0, route.id, route.parameters]);
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

}

function requiredNavigation(value: OperationOutputFor<'storefront.bootstrap.read'>): NonNullable<OperationOutputFor<'storefront.bootstrap.read'>['navigation']['data']> {
  if (value.navigation.data === null) throw new Error('MINIAPP_NAVIGATION_MISSING');
  return value.navigation.data;
}

function requiredReader(feature: MiniappFeatureViewModel): NonNullable<MiniappFeatureViewModel['read']> {
  if (feature.read === undefined) throw new Error('MINIAPP_FEATURE_READER_MISSING');
  return feature.read;
}

type BootstrapNavigationNode = ReturnType<typeof requiredNavigation>[number];

function flattenNavigation(nodes: readonly BootstrapNavigationNode[]): readonly BootstrapNavigationNode[] {
  return nodes.flatMap((node) => [node, ...flattenNavigation(node.children)]);
}

export function createMiniappRuntime(): MiniappRuntime {
  const environment = readMiniappEnvironment();
  const cookies = new CookieJar();
  const core = createMiniappCore(environment, cookies);
  return new MiniappRuntime(environment, core.client, core.executor, cookies);
}
