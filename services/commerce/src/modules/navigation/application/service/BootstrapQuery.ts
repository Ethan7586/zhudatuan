import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import { allParallel } from '../../../../foundation/performance/Parallel';
import type { MembershipReadPort } from '../../../access/public/MembershipReadPort';
import type { BenefitReadPort } from '../../../benefit/public/BenefitReadPort';
import type { ExperienceReadPort } from '../../../experience/public/ExperienceReadPort';
import type { IdentityReadPort } from '../../../identity/public/IdentityReadPort';
import type { MemberReadPort } from '../../../member/public/MemberReadPort';
import type { OrderReadPort } from '../../../order/public/OrderReadPort';
import type { NavigationReadPort } from '../../public/NavigationReadPort';
import { BootstrapMapper, type BootstrapSection } from './BootstrapMapper';

export interface BootstrapPorts {
  readonly identity: IdentityReadPort;
  readonly membership: MembershipReadPort;
  readonly navigation: NavigationReadPort;
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

  async execute(input: OperationInputFor<'storefront.bootstrap.read'>, context: HandlerContext<'storefront.bootstrap.read'>) {
    const host = canonicalHost(context.headers);
    const binding = await this.ports.experience.resolveHost(context.transaction, host);
    const identity = this.ports.identity.resolve(context.security, context.headers);
    const transaction = context.transaction;
    const memberId = identity.membership ? await this.ports.membership.member(transaction, identity.membership) : null;
    const member = memberId ? await this.ports.member.summary(transaction, memberId) : null;
    if (identity.state === 'member' && !member) throw new Error('STOREFRONT_MEMBERSHIP_INVALID');
    assertMallAccess(context, binding.mall);
    const navigation = this.ports.navigation.storefront();
    const tasks = [
      () => this.ports.experience.published(transaction, binding),
      () => (member ? this.ports.benefit.summary(transaction, member.id, binding.mall) : Promise.resolve(null)),
      () => (member ? this.ports.order.summary(transaction, member.id, binding.mall) : Promise.resolve(null)),
    ] as const;
    const settled = await allParallel([() => settle(tasks[0]), () => settle(tasks[1]), () => settle(tasks[2])] as const, { concurrency: 6, expiresAt: context.deadline, signal: context.signal });
    const experience = settled[0];
    if (experience.status !== 'fulfilled') throw experience.reason;
    const benefit = partition(settled[1], this.mapper);
    const orders = partition(settled[2], this.mapper);
    const body = this.mapper.result({
      state: benefit.state === 'failed' || orders.state === 'failed' ? 'partial' : 'complete',
      host,
      binding: Object.freeze(binding),
      identity: this.mapper.section(
        {
          state: identity.state,
          member: member ? { id: member.id, displayName: member.displayName } : null,
          membership: identity.membership,
          ...(identity.csrf === undefined ? {} : { csrf: identity.csrf }),
        },
        identity.version
      ),
      navigation: this.mapper.section(navigation.items, navigation.version),
      benefit,
      orders,
      experience: this.mapper.section(experience.value.document, experience.value.version, experience.value.asOf),
    });
    return { status: 200, body, headers: { 'cache-control': identity.state === 'anonymous' ? 'public,max-age=30' : 'private,no-store' } };
  }
}

async function settle<T>(operation: () => Promise<T>): Promise<PromiseSettledResult<T>> {
  try {
    return { status: 'fulfilled', value: await operation() };
  } catch (reason) {
    return { status: 'rejected', reason };
  }
}

function partition<T>(result: PromiseSettledResult<T | null>, mapper: BootstrapMapper): BootstrapSection<T> {
  if (result.status === 'rejected') return mapper.failed<T>();
  return result.value === null ? mapper.unavailable<T>() : mapper.section(result.value, versionOf(result.value));
}

function versionOf(value: unknown): string {
  if (value && typeof value === 'object' && 'version' in value) return String(Reflect.get(value, 'version'));
  return '1';
}

function assertMallAccess(context: HandlerContext<'storefront.bootstrap.read'>, mall: string): void {
  if (context.security.kind !== 'session') return;
  if (context.security.access.organization === mall) return;
  throw new Error('STOREFRONT_MEMBERSHIP_MALL_MISMATCH');
}

export function canonicalHost(headers: Readonly<Record<string, string>>): string {
  const host = headers.host?.split(':')[0]?.trim().toLowerCase();
  const forwarded = headers['x-forwarded-host'];
  if (!host || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(host)) throw new Error('STOREFRONT_HOST_INVALID');
  if (forwarded !== undefined && forwarded.split(',')[0]?.trim().toLowerCase().split(':')[0] !== host) throw new Error('STOREFRONT_FORWARDED_HOST_UNTRUSTED');
  return host;
}
