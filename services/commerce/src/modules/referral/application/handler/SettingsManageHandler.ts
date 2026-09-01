import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { ReferralSetting } from '../../domain/model/ReferralSetting';
import type { ReferralRepository } from '../port/ReferralRepository';

export class SettingsManageHandler implements OperationHandler<'referral.settings.manage', 'write'> {
  readonly operation = 'referral.settings.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly referrals: ReferralRepository) {}
  async execute(input: OperationInputFor<'referral.settings.manage'>, context: WriteHandlerContext<'referral.settings.manage'>): Promise<OperationReply<OperationOutputFor<'referral.settings.manage'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const model = new ReferralSetting(
      input.path.settingid,
      access.scope.id,
      booleanField(body, 'enabled'),
      integerField(body, 'firstTouchDays', 1),
      integerField(body, 'rateBasisPoints'),
      BigInt(integerField(body, 'minimumWithdrawalMinor')),
      textField(body, 'currency', 3),
      expected(context.expectedVersion)
    );
    const result = await this.referrals.manageSetting(context.transaction, {
      id: model.id,
      scopeId: model.scopeId,
      enabled: model.enabled,
      firstTouchDays: model.firstTouchDays,
      rateBasisPoints: model.rate.basisPoints,
      minimumWithdrawalMinor: Number(model.minimumWithdrawalMinor),
      currency: model.currency,
      expectedVersion: model.version,
    });
    return { status: 200, body: result as OperationOutputFor<'referral.settings.manage'> };
  }
}

function expected(value: number | undefined): number {
  if (!Number.isSafeInteger(value) || value! < 1) throw new DomainError('VERSION_CONFLICT');
  return value!;
}
function booleanField(body: Readonly<Record<string, unknown>>, field: string): boolean {
  if (typeof body[field] !== 'boolean') throw new DomainError('VALIDATION_FAILED', { field });
  return body[field] as boolean;
}
