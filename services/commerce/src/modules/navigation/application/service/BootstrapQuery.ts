import { isConsumerTarget, type OperationInputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import { allParallel } from '../../../../foundation/performance/Parallel';
import type { MembershipReadPort } from '../../../access/public/MembershipReadPort';
import type { BenefitReadPort } from '../../../benefit/public/BenefitReadPort';
import type { NavigationCapabilityPort } from '../../../capability/public';
import type { ExperienceReadPort } from '../../../experience/public/ExperienceReadPort';
import type { IdentityReadPort } from '../../../identity/public/IdentityReadPort';
import type { MemberReadPort } from '../../../member/public/MemberReadPort';
import type { OrderReadPort } from '../../../order/public/OrderReadPort';
import type { ConsumerNavigationReader } from '../port/ConsumerNavigationReader';
import { NavigationContext } from '../../domain/model/NavigationContext';
import { BootstrapMapper, type BootstrapSection } from './BootstrapMapper';
import { assertEntryMall, entryHandle } from './EntryHandle';

export interface BootstrapPorts {
  readonly identity: IdentityReadPort;
  readonly membership: MembershipReadPort;
  readonly navigation: ConsumerNavigationReader;
  readonly capability: NavigationCapabilityPort;
  readonly member: MemberReadPort;
  readonly benefit: BenefitReadPort;
  readonly order: OrderReadPort;
  readonly experience: ExperienceReadPort;
}

export class BootstrapQuery {
  constructor(
    private readonly ports: BootstrapPorts,
    private readonly mapper = new BootstrapMapper()
  ) {}

  entry(context: HandlerContext<'storefront.bootstrap.read'>) {
    return this.ports.experience.resolveEntry(context.transaction, entryHandle(context));
  }

  async execute(input: OperationInputFor<'storefront.bootstrap.read'>, context: HandlerContext<'storefront.bootstrap.read'>, resolved?: Awaited<ReturnType<BootstrapQuery['entry']>>) {
    const binding = resolved ?? (await this.entry(context));
    assertEntryMall(context, binding.mall);
    const identity = this.ports.identity.resolve(context.security, context.headers);
    const transaction = context.transaction;
    const memberId = identity.membership ? await this.ports.membership.member(transaction, identity.membership) : null;
    const member = memberId ? await this.ports.member.summary(transaction, memberId, binding.mall) : null;
    if (identity.state === 'member' && !member) throw new Error('STOREFRONT_MEMBERSHIP_INVALID');
    const target = context.security.kind === 'session' ? context.security.access.actor.target : context.security.target;
    if (!isConsumerTarget(target)) throw new DomainError('AUTHORIZATION_DENIED');
    const tasks = [
      () => this.ports.experience.published(transaction, binding),
      () => (member ? this.ports.benefit.summary(transaction, member.id, binding.mall) : Promise.resolve(null)),
      () => (member ? this.ports.order.summary(transaction, member.id, binding.mall) : Promise.resolve(null)),
      () => this.ports.capability.read(transaction, Object.freeze([binding.mall]), target),
    ] as const;
    const settled = await allParallel([() => settle(tasks[0]), () => settle(tasks[1]), () => settle(tasks[2]), () => settle(tasks[3])] as const, { concurrency: 4, expiresAt: context.deadline, signal: context.signal });
    const experience = settled[0];
    if (experience.status !== 'fulfilled') throw experience.reason;
    const capabilityResult = settled[3];
    if (capabilityResult.status !== 'fulfilled') throw capabilityResult.reason;
    const capability = capabilityResult.value.find(({ scope }) => scope === binding.mall) ?? Object.freeze({ scope: binding.mall, capabilities: new Set<string>(), version: 0 });
    if (context.security.kind === 'session' && capability.version !== context.security.access.capabilityVersion) throw new DomainError('ACCESS_VERSION_STALE');
    const principal = context.security.kind === 'session' ? context.security.access.actor.id : (context.publicActor ?? `anonymous:${target}`);
    const membership = identity.membership ?? 'anonymous';
    const permissions = context.security.kind === 'session' ? effectivePermissions(context.security.access) : new Set<string>();
    const navigationContext = new NavigationContext({
      target,
      principal,
      membership,
      membershipActive: context.security.kind !== 'session' || context.security.access.membership.active,
      assurance: context.security.kind === 'session' ? context.security.access.assurance.level : 0,
      scope: { membership, id: binding.mall, kind: 'mall', status: 'active', version: 1, default: true },
      scopes: [{ membership, id: binding.mall, kind: 'mall', status: 'active', version: 1, default: true }],
      permissions,
      capabilities: capability.capabilities,
      featureFlags: this.ports.navigation.featureFlags,
      accessVersion: identity.version,
      capabilityVersion: capability.version,
    });
    const navigation = this.ports.navigation.read(navigationContext);
    const asOf = new Date().toISOString();
    const benefit = partition(settled[1], this.mapper, asOf);
    const orders = partition(settled[2], this.mapper, asOf);
    const body = this.mapper.result({
      state: benefit.state === 'failed' || orders.state === 'failed' ? 'partial' : 'complete',
      entry: Object.freeze({ handle: binding.handle, url: binding.url }),
      binding: Object.freeze({ application: binding.application, mall: binding.mall, pool: binding.pool, release: binding.release, version: binding.version, tenant: binding.tenant }),
      subject: Object.freeze({ principal, membership: identity.membership, member: member?.id ?? null }),
      scope: Object.freeze({ id: binding.mall, kind: 'mall', tenant: binding.tenant }),
      capabilities: Object.freeze({ version: capability.version, values: Object.freeze([...capability.capabilities].sort()) }),
      navigationVersion: navigation.version,
      identity: this.mapper.section(
        {
          state: identity.state,
          member: member ? { id: member.id, displayName: member.displayName } : null,
          membership: identity.membership,
          ...(identity.csrf === undefined ? {} : { csrf: identity.csrf }),
        },
        identity.version,
        asOf
      ),
      navigation: this.mapper.section(navigation.nodes, navigation.version, asOf),
      benefit,
      orders,
      experience: this.mapper.section(experience.value.document, experience.value.version, experience.value.asOf),
    });
    return { status: 200, body, headers: { 'cache-control': 'private,no-store' } };
  }

}

function effectivePermissions(access: Extract<HandlerContext<'storefront.bootstrap.read'>['security'], { kind: 'session' }>['access']): ReadonlySet<string> {
  return new Set([...access.membership.permissions.allows].filter((permission) => !access.membership.permissions.denies.has(permission)));
}

async function settle<T>(operation: () => Promise<T>): Promise<PromiseSettledResult<T>> {
  try {
    return { status: 'fulfilled', value: await operation() };
  } catch (reason) {
    return { status: 'rejected', reason };
  }
}

function partition<T>(result: PromiseSettledResult<T | null>, mapper: BootstrapMapper, asOf: string): BootstrapSection<T> {
  if (result.status === 'rejected') return mapper.failed<T>(asOf);
  return result.value === null ? mapper.unavailable<T>(asOf) : mapper.section(result.value, versionOf(result.value), asOf);
}

function versionOf(value: unknown): string {
  if (value && typeof value === 'object' && 'version' in value) return String(Reflect.get(value, 'version'));
  return '1';
}
