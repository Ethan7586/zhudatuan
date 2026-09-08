import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { REFERRAL_SOURCES, type ReferralBinding, type ReferralSource } from '../../domain/model/ReferralBinding';
import type { Clock } from '../port/Clock';
import type { Identifier } from '../port/Identifier';
import type { ReferralRepository } from '../port/ReferralRepository';
import type { ReferralToken } from '../../domain/value/ReferralToken';
import { BindReferral } from '../service/BindReferral';

export class BindingsCreateHandler implements OperationHandler<'referral.bindings.create', 'write'> {
  readonly operation = 'referral.bindings.create' as const;
  readonly mode = 'write' as const;
  private readonly bind: BindReferral;
  constructor(
    private readonly referrals: ReferralRepository,
    private readonly identifiers: Identifier,
    private readonly tokens: ReferralToken,
    private readonly clock: Clock
  ) {
    this.bind = new BindReferral(referrals);
  }
  async execute(input: OperationInputFor<'referral.bindings.create'>, context: WriteHandlerContext<'referral.bindings.create'>): Promise<OperationReply<OperationOutputFor<'referral.bindings.create'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const member = await this.referrals.eligible(context.transaction, access.scope.id, access.membership.id);
    if (!member) throw new DomainError('REFERRAL_NOT_ELIGIBLE');
    const raw = textField(body, 'token', 2048);
    const claims = this.tokens.verify(raw, member.scopeId, this.clock.now());
    const setting = await this.referrals.setting(context.transaction, member.scopeId);
    if (setting?.enabled !== true || Number(setting.version) !== claims.settingVersion) throw new DomainError('REFERRAL_INVALID_TOKEN');
    const now = this.clock.now();
    const boundAt = now.toISOString();
    const expiresAt = setting.bindingMode === 'permanent' ? null : new Date(now.getTime() + Number(setting.firstTouchDays) * 86_400_000).toISOString();
    const result = await this.bind.execute(context.transaction, {
      id: this.identifiers.next('referralbinding'),
      scopeId: member.scopeId,
      customerId: member.memberId,
      promoterId: claims.promoterId,
      fingerprint: this.tokens.fingerprint(raw),
      source: referralSource(textField(body, 'source', 100)),
      boundAt,
      expiresAt,
    });
    return { status: result.created ? 201 : 200, body: bindingOutput(result.binding) };
  }
}

function bindingOutput(value: ReferralBinding): OperationOutputFor<'referral.bindings.create'> {
  return Object.freeze({
    id: value.id,
    promoterId: value.promoterId,
    memberId: value.customerId,
    source: value.source,
    boundAt: value.boundAt,
    expiresAt: value.expiresAt,
    status: value.state,
    version: value.version,
  }) as unknown as OperationOutputFor<'referral.bindings.create'>;
}

function referralSource(value: string): ReferralSource {
  if (!REFERRAL_SOURCES.includes(value as ReferralSource)) throw new DomainError('VALIDATION_FAILED', { field: 'source' });
  return value as ReferralSource;
}
