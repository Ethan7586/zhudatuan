import { randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { Clock } from '../port/Clock';
import type { ReferralRepository } from '../port/ReferralRepository';
import type { ReferralToken } from '../../domain/value/ReferralToken';

export class LinksReadHandler implements OperationHandler<'referral.links.read', 'read'> {
  readonly operation = 'referral.links.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly referrals: ReferralRepository,
    private readonly tokens: ReferralToken,
    private readonly clock: Clock
  ) {}
  async execute(input: OperationInputFor<'referral.links.read'>, context: HandlerContext<'referral.links.read'>): Promise<OperationReply<OperationOutputFor<'referral.links.read'>>> {
    const access = requireSession(context.security);
    const member = await this.referrals.eligible(context.transaction, access.scope.id, access.membership.id);
    if (!member) throw new DomainError('REFERRAL_NOT_ELIGIBLE');
    const active = await this.referrals.link(context.transaction, member.scopeId, member.memberId);
    if (!active) throw new DomainError('REFERRAL_NOT_ELIGIBLE');
    const expiresAt = new Date(this.clock.now().getTime() + Math.min(active.firstTouchDays, 30) * 86_400_000).toISOString();
    const token = this.tokens.issue({ scopeId: member.scopeId, promoterId: active.promoterId, expiresAt, nonce: randomUUID(), settingVersion: active.settingVersion });
    const product = queryValue(input.query?.productId);
    const query = new URLSearchParams({ referral: token });
    if (product) query.set('product', product);
    return { status: 200, body: { token, url: `?${query.toString()}`, expiresAt, productId: product || null } as OperationOutputFor<'referral.links.read'> };
  }
}

function queryValue(value: unknown): string {
  const selected = Array.isArray(value) ? value[0] : value;
  return typeof selected === 'string' ? selected.trim() : '';
}
