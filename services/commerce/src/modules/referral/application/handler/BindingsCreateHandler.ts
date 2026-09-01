import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { AttributionPolicy } from '../../domain/policy/AttributionPolicy';
import { ReferralBinding } from '../../domain/model/ReferralBinding';
import type { Clock } from '../port/Clock';
import type { Identifier } from '../port/Identifier';
import type { ReferralRepository } from '../port/ReferralRepository';
import type { ReferralToken } from '../../domain/value/ReferralToken';

export class BindingsCreateHandler implements OperationHandler<'referral.bindings.create', 'write'> {
  readonly operation = 'referral.bindings.create' as const;
  readonly mode = 'write' as const;
  private readonly attribution = new AttributionPolicy();
  constructor(
    private readonly referrals: ReferralRepository,
    private readonly identifiers: Identifier,
    private readonly tokens: ReferralToken,
    private readonly clock: Clock
  ) {}
  async execute(input: OperationInputFor<'referral.bindings.create'>, context: WriteHandlerContext<'referral.bindings.create'>): Promise<OperationReply<OperationOutputFor<'referral.bindings.create'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const member = await this.referrals.eligible(context.transaction, access.scope.id, access.membership.id);
    if (!member) throw new DomainError('REFERRAL_NOT_ELIGIBLE');
    const raw = textField(body, 'token', 2048);
    const claims = this.tokens.verify(raw, member.scopeId, this.clock.now());
    const setting = await this.referrals.setting(context.transaction, member.scopeId);
    if (setting?.enabled !== true || Number(setting.version) !== claims.settingVersion) throw new DomainError('REFERRAL_INVALID_TOKEN');
    const candidate = new ReferralBinding(this.identifiers.next('referralbinding'), member.scopeId, member.memberId, claims.promoterId, this.tokens.fingerprint(raw), this.clock.now().toISOString(), 1);
    const existingRow = await this.referrals.binding(context.transaction, member.scopeId, member.memberId);
    const existing = existingRow ? binding(existingRow) : undefined;
    if (this.attribution.choose(existing, candidate) !== candidate) throw new DomainError('REFERRAL_ALREADY_BOUND');
    const result = await this.referrals.bind(context.transaction, {
      id: candidate.id,
      scopeId: candidate.scopeId,
      customerId: candidate.customerId,
      promoterId: candidate.promoterId,
      fingerprint: candidate.tokenFingerprint,
      source: textField(body, 'source', 100),
    });
    return { status: 201, body: result as OperationOutputFor<'referral.bindings.create'> };
  }
}

function binding(row: Readonly<Record<string, unknown>>): ReferralBinding {
  return new ReferralBinding(
    String(row.id ?? ''),
    String(row.scopeId ?? ''),
    String(row.customerId ?? ''),
    String(row.promoterId ?? ''),
    String(row.tokenFingerprint ?? ''),
    new Date(String(row.boundAt ?? '')).toISOString(),
    Number(row.version)
  );
}
