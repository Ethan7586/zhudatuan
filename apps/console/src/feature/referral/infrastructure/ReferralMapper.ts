import { deepFreeze } from '../../../shared/model/Immutable';
import type { ReferralBinding, ReferralCommission, ReferralMember, ReferralPage, ReferralProduct, ReferralSetting, ReferralWithdrawal } from '../model/Referral';
import { ReferralBindingPageSchema, ReferralCommissionPageSchema, ReferralMemberPageSchema, ReferralProductPageSchema, ReferralSettingSchema, ReferralWithdrawalPageSchema } from './ReferralSchema';

export class ReferralMapper {
  settings(value: unknown): ReferralPage {
    const item = ReferralSettingSchema.parse(value);
    return deepFreeze({ section: 'settings', items: [this.setting(item)], count: 1 });
  }

  products(value: unknown): ReferralPage {
    return this.page('product', ReferralProductPageSchema.parse(value), (item) => this.product(item));
  }
  members(value: unknown): ReferralPage {
    return this.page('review', ReferralMemberPageSchema.parse(value), (item) => this.member(item));
  }
  bindings(value: unknown): ReferralPage {
    return this.page('binding', ReferralBindingPageSchema.parse(value), (item) => this.binding(item));
  }
  withdrawals(value: unknown): ReferralPage {
    return this.page('withdrawal', ReferralWithdrawalPageSchema.parse(value), (item) => this.withdrawal(item));
  }
  commissions(value: unknown): ReferralPage {
    return this.page('promotion', ReferralCommissionPageSchema.parse(value), (item) => this.commission(item));
  }

  private setting(item: ReturnType<typeof ReferralSettingSchema.parse>): ReferralSetting {
    return {
      id: item.id,
      scopeId: item.scopeId,
      enabled: item.enabled,
      firstTouchDays: item.firstTouchDays,
      rateBasisPoints: item.rateBasisPoints,
      minimumWithdrawalMinor: item.minimumWithdrawalMinor,
      currency: item.currency,
      version: item.version,
      updatedAt: item.updatedAt,
    };
  }

  private product(item: ReturnType<typeof ReferralProductPageSchema.parse>['items'][number]): ReferralProduct {
    return { id: item.id, productId: item.productId, enabled: item.enabled, rateBasisPoints: item.rateBasisPoints, version: item.version, updatedAt: item.updatedAt };
  }

  private member(item: ReturnType<typeof ReferralMemberPageSchema.parse>['items'][number]): ReferralMember {
    return { id: item.id, memberId: item.memberId, status: item.status, appliedAt: item.appliedAt, approvedAt: item.approvedAt, disqualifiedAt: item.disqualifiedAt, version: item.version };
  }

  private binding(item: ReturnType<typeof ReferralBindingPageSchema.parse>['items'][number]): ReferralBinding {
    return { id: item.id, promoterId: item.promoterId, memberId: item.memberId, source: item.source, boundAt: item.boundAt, version: item.version };
  }

  private withdrawal(item: ReturnType<typeof ReferralWithdrawalPageSchema.parse>['items'][number]): ReferralWithdrawal {
    return {
      id: item.id,
      memberId: item.memberId,
      status: item.status,
      amountMinor: item.amountMinor,
      currency: item.currency,
      accountRef: item.accountRef,
      requestedAt: item.requestedAt,
      completedAt: item.completedAt,
      failureReason: item.failureReason,
      version: item.version,
    };
  }

  private commission(item: ReturnType<typeof ReferralCommissionPageSchema.parse>['items'][number]): ReferralCommission {
    return { id: item.id, orderId: item.orderId, promoterId: item.promoterId, status: item.status, amountMinor: item.amountMinor, currency: item.currency, availableAt: item.availableAt, version: item.version };
  }

  private page<TItem, TResult, TSection extends Exclude<ReferralPage['section'], 'settings'>>(
    section: TSection,
    value: Readonly<{ items: readonly TItem[]; count: number; nextCursor?: string | undefined }>,
    map: (item: TItem) => TResult
  ): ReferralPage {
    if (value.count !== value.items.length) throw new Error('REFERRAL_PAGE_COUNT_MISMATCH');
    return deepFreeze({ section, items: value.items.map(map), count: value.count, ...(value.nextCursor === undefined ? {} : { nextCursor: value.nextCursor }) }) as ReferralPage;
  }
}
