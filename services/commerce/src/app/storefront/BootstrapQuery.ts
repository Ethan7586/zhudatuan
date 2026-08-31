import type { OperationRequest, OperationResult } from '../../foundation/application/OperationExecution';
import { allParallel } from '../../foundation/performance/Parallel';
import type { ReadScope } from '../../foundation/persistence/ReadSession';
import type { BenefitReadPort } from '../../modules/benefit/public/BenefitReadPort';
import type { MembershipReadPort } from '../../modules/access/public/MembershipReadPort';
import type { ExperienceReadPort } from '../../modules/experience/public/ExperienceReadPort';
import type { IdentityReadPort } from '../../modules/identity/public/IdentityReadPort';
import type { MemberReadPort } from '../../modules/member/public/MemberReadPort';
import type { NavigationReadPort } from '../../modules/navigation/public/NavigationReadPort';
import type { OrderReadPort } from '../../modules/order/public/OrderReadPort';
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

  async execute(request: OperationRequest): Promise<OperationResult> {
    const host = canonicalHost(request.input.headers);
    const binding = await this.ports.experience.resolveHost(host);
    const identity = this.ports.identity.resolve(request.security);
    const readScope = scopeFor(request, binding.tenant, binding.mall);
    const memberId = identity.membership ? await this.ports.membership.member(readScope, identity.membership) : null;
    const member = memberId ? await this.ports.member.summary(readScope, memberId) : null;
    if (identity.state === 'member' && !member) throw new Error('STOREFRONT_MEMBERSHIP_INVALID');
    assertMallAccess(request, binding.mall);
    const navigation = this.ports.navigation.storefront();
    const tasks = [
      () => this.ports.experience.published(readScope, binding),
      () => (member ? this.ports.benefit.summary(readScope, member.id, binding.mall) : Promise.resolve(null)),
      () => (member ? this.ports.order.summary(readScope, member.id, binding.mall) : Promise.resolve(null)),
    ] as const;
    const settled = await allParallel([() => settle(tasks[0]), () => settle(tasks[1]), () => settle(tasks[2])] as const, { concurrency: 6, expiresAt: request.input.deadline, signal: request.input.signal });
    const experience = settled[0];
    if (experience.status !== 'fulfilled') throw experience.reason;
    const benefit = partition(settled[1], this.mapper);
    const orders = partition(settled[2], this.mapper);
    const body = this.mapper.result({
      state: benefit.state === 'failed' || orders.state === 'failed' ? 'partial' : 'complete',
      host,
      binding: Object.freeze(binding),
      identity: this.mapper.section({ state: identity.state, member: member ? { id: member.id, displayName: member.displayName } : null, membership: identity.membership }, identity.version),
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

function scopeFor(request: OperationRequest, tenant: string, mall: string): ReadScope {
  if (request.security.kind === 'session') {
    const access = request.security.access;
    return Object.freeze({ tenant, membership: access.membership.id, scope: mall, actor: access.actor.id, trace: access.trace, operation: request.type });
  }
  return Object.freeze({ tenant, membership: '', scope: mall, actor: 'public:storefront', trace: request.security.trace, operation: request.type });
}

function assertMallAccess(request: OperationRequest, mall: string): void {
  if (request.security.kind !== 'session') return;
  if (request.security.access.organization === mall) return;
  throw new Error('STOREFRONT_MEMBERSHIP_MALL_MISMATCH');
}

export function canonicalHost(headers: Readonly<Record<string, string>>): string {
  const host = headers.host?.split(':')[0]?.trim().toLowerCase();
  const forwarded = headers['x-forwarded-host'];
  if (!host || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(host)) throw new Error('STOREFRONT_HOST_INVALID');
  if (forwarded !== undefined && forwarded.split(',')[0]?.trim().toLowerCase().split(':')[0] !== host) throw new Error('STOREFRONT_FORWARDED_HOST_UNTRUSTED');
  return host;
}
