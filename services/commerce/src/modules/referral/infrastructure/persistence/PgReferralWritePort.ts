import type { ReferralWritePort } from '../../public';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ReferralRepository } from '../../application/port/ReferralRepository';
import { BindReferral } from '../../application/service/BindReferral';

export class PgReferralWritePort implements ReferralWritePort {
  private readonly bindReferral: BindReferral;
  constructor(referrals: ReferralRepository) {
    this.bindReferral = new BindReferral(referrals);
  }
  async bind(context: Parameters<ReferralWritePort['bind']>[0], input: Parameters<ReferralWritePort['bind']>[1]) {
    if (context.scope !== input.scopeId) throw new DomainError('SCOPE_DENIED');
    const result = await this.bindReferral.execute(context, input);
    return Object.freeze({ id: result.binding.id, version: result.binding.version });
  }
}
