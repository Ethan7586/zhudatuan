import { chineseReference } from '@shop/presentation';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import { referralSections, type ReferralAction, type ReferralPage, type ReferralSection } from '../model/Referral';
import { referralWriteOperations } from '../model/ReferralOperation';
import { bindingViewModel, type BindingViewModel } from './BindingViewModel';
import { productViewModel, type ProductViewModel } from './ProductViewModel';
import { promotionViewModel, type PromotionViewModel } from './PromotionViewModel';
import { reviewViewModel, type ReviewViewModel } from './ReviewViewModel';
import { settingsViewModel, type SettingsViewModel } from './SettingsViewModel';
import { withdrawalViewModel, type WithdrawalViewModel } from './WithdrawalViewModel';

export type ReferralContentViewModel = SettingsViewModel | ProductViewModel | ReviewViewModel | BindingViewModel | WithdrawalViewModel | PromotionViewModel;

export function referralContent(page: ReferralPage, context: ConsoleContext, begin: (action: ReferralAction) => void): ReferralContentViewModel {
  if (page.section === 'settings') return settingsViewModel(page.items, canUseOperation(context, referralWriteOperations.setting), (item) => begin({ kind: 'setting', item, label: '编辑分销设定' }));
  if (page.section === 'product') return productViewModel(page.items, canUseOperation(context, referralWriteOperations.product), (item) => begin({ kind: 'product', item, label: `编辑${chineseReference('商品', item.productId)}` }));
  if (page.section === 'review')
    return reviewViewModel(
      page.items,
      canUseOperation(context, referralWriteOperations.approve),
      canUseOperation(context, referralWriteOperations.disqualify),
      (item) => begin({ kind: 'approve', item, label: `通过${chineseReference('会员', item.memberId)}` }),
      (item) => begin({ kind: 'disqualify', item, label: `取消${chineseReference('会员', item.memberId)}资格` })
    );
  if (page.section === 'binding') return bindingViewModel(page.items);
  if (page.section === 'withdrawal') return withdrawalViewModel(page.items);
  return promotionViewModel(page.items);
}

export function readReferralRoute(pathname: string): Readonly<{ section: ReferralSection; valid: boolean }> {
  const value = pathname.split('/').filter(Boolean).at(-1);
  if (value === 'referral') return Object.freeze({ section: 'settings', valid: true });
  if (referralSections.includes(value as ReferralSection)) return Object.freeze({ section: value as ReferralSection, valid: true });
  return Object.freeze({ section: 'settings', valid: false });
}
