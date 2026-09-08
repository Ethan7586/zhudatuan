import { DomainError } from '../../../../platform/error/DomainError';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { ReferralBinding, type ReferralSource } from '../../domain/model/ReferralBinding';
import { AttributionPolicy } from '../../domain/policy/AttributionPolicy';
import type { ReferralRepository } from '../port/ReferralRepository';

export interface BindReferralInput {
  readonly id: string;
  readonly scopeId: string;
  readonly customerId: string;
  readonly promoterId: string;
  readonly fingerprint: string;
  readonly source: ReferralSource;
  readonly boundAt: string;
  readonly expiresAt: string | null;
}

export class BindReferral {
  private readonly policy = new AttributionPolicy();

  constructor(private readonly referrals: ReferralRepository) {}

  async execute(context: WriteTransactionContext, input: BindReferralInput) {
    const setting = await this.referrals.setting(context, input.scopeId);
    const duration = input.expiresAt === null ? null : Date.parse(input.expiresAt) - Date.parse(input.boundAt);
    const periodValid = setting?.bindingMode === 'permanent' ? input.expiresAt === null : duration === Number(setting?.firstTouchDays) * 86_400_000;
    if (setting?.enabled !== true || !periodValid) throw new DomainError('REFERRAL_INVALID_TOKEN');
    const relation = await this.referrals.attribution(context, input.scopeId, input.promoterId, input.boundAt);
    if (!relation) throw new DomainError('REFERRAL_INVALID_TOKEN');
    const candidate = new ReferralBinding(input.id, input.scopeId, input.customerId, input.promoterId, relation.promoterMemberId, input.fingerprint, input.source, input.boundAt, input.expiresAt, 'active', 1);
    const current = await this.referrals.binding(context, input.scopeId, input.customerId);
    const existing = current ? referralBinding(current) : undefined;
    const selected = this.policy.choose(existing, candidate, relation.ancestors, new Date(input.boundAt));
    if (selected !== candidate) {
      if (selected.tokenFingerprint !== candidate.tokenFingerprint) throw new DomainError('REFERRAL_ALREADY_BOUND');
      return Object.freeze({ binding: selected, created: false });
    }
    await this.referrals.bind(context, {
      id: candidate.id,
      scopeId: candidate.scopeId,
      customerId: candidate.customerId,
      promoterId: candidate.promoterId,
      promoterMemberId: candidate.promoterMemberId,
      fingerprint: candidate.tokenFingerprint,
      source: candidate.source,
      boundAt: candidate.boundAt,
      expiresAt: candidate.expiresAt,
    });
    return Object.freeze({ binding: candidate, created: true });
  }
}

export function referralBinding(row: Readonly<Record<string, unknown>>): ReferralBinding {
  return new ReferralBinding(
    String(row.id ?? ''),
    String(row.scopeId ?? ''),
    String(row.memberId ?? row.customerId ?? ''),
    String(row.promoterId ?? ''),
    String(row.promoterMemberId ?? ''),
    String(row.tokenFingerprint ?? ''),
    referralSource(String(row.source ?? '')),
    new Date(String(row.boundAt ?? '')).toISOString(),
    row.expiresAt === null || row.expiresAt === undefined ? null : new Date(String(row.expiresAt)).toISOString(),
    String(row.status ?? row.state ?? '') === 'superseded' ? 'superseded' : 'active',
    Number(row.version)
  );
}

function referralSource(value: string): ReferralSource {
  if (!['storefront', 'miniapp', 'checkout'].includes(value)) throw new DomainError('VALIDATION_FAILED', { field: 'source' });
  return value as ReferralSource;
}
