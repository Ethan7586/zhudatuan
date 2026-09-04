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
import { assertEntryMall, entryHandle } from './EntryHandle';

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
    const handle = entryHandle(context);
    const binding = await this.ports.experience.resolveEntry(context.transaction, handle);
    assertEntryMall(context, binding.mall);
    const identity = this.ports.identity.resolve(context.security, context.headers);
    const transaction = context.transaction;
    const memberId = identity.membership ? await this.ports.membership.member(transaction, identity.membership) : null;
    const member = memberId ? await this.ports.member.summary(transaction, memberId, binding.mall) : null;
    if (identity.state === 'member' && !member) throw new Error('STOREFRONT_MEMBERSHIP_INVALID');
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
      entry: Object.freeze({ handle: binding.handle, url: binding.url }),
      binding: Object.freeze({ application: binding.application, mall: binding.mall, pool: binding.pool, release: binding.release, version: binding.version, tenant: binding.tenant }),
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
    return { status: 200, body, headers: { 'cache-control': 'private,no-store' } };
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
