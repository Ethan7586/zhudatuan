import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { bodyRecord, integerField, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
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
      booleanField(body, 'recruitEnabled'),
      booleanField(body, 'reviewRequired'),
      booleanField(body, 'rewardEnabled'),
      bindingMode(textField(body, 'bindingMode')),
      integerField(body, 'firstTouchDays', 1),
      integerField(body, 'freezeDays'),
      settlementTrigger(textField(body, 'settlementTrigger')),
      integerField(body, 'rateBasisPoints'),
      BigInt(integerField(body, 'minimumWithdrawalMinor')),
      nullableInteger(body.monthlyWithdrawalLimit),
      textField(body, 'currency', 3),
      expected(context.expectedVersion)
    );
    const result = await this.referrals.manageSetting(context.transaction, {
      id: model.id,
      scopeId: model.scopeId,
      enabled: model.enabled,
      recruitEnabled: model.recruitEnabled,
      reviewRequired: model.reviewRequired,
      rewardEnabled: model.rewardEnabled,
      bindingMode: model.bindingMode,
      firstTouchDays: model.firstTouchDays,
      freezeDays: model.freezeDays,
      settlementTrigger: model.settlementTrigger,
      rateBasisPoints: model.rate.basisPoints,
      minimumWithdrawalMinor: Number(model.minimumWithdrawalMinor),
      monthlyWithdrawalLimit: model.monthlyWithdrawalLimit,
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
function bindingMode(value: string): 'permanent' | 'days' {
  if (value !== 'permanent' && value !== 'days') throw new DomainError('VALIDATION_FAILED', { field: 'bindingMode' });
  return value;
}
function settlementTrigger(value: string): 'paid' | 'received' {
  if (value !== 'paid' && value !== 'received') throw new DomainError('VALIDATION_FAILED', { field: 'settlementTrigger' });
  return value;
}
function nullableInteger(value: unknown): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new DomainError('VALIDATION_FAILED', { field: 'monthlyWithdrawalLimit' });
  return Number(value);
}
