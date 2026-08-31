import { createFetchReferralBindingsRead, createFetchReferralCommissionsRead, createFetchReferralMembersRead, createFetchReferralProductsRead, createFetchReferralSettingsRead, createFetchReferralWithdrawalsRead } from '@shop/sdk/referral';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import type { ReferralBinding, ReferralCommission, ReferralMember, ReferralPage, ReferralProduct, ReferralSetting, ReferralView, ReferralWithdrawal } from './ReferralSchema';

const settingsRead = createFetchReferralSettingsRead(appConfig.apiBaseUrl);
const productsRead = createFetchReferralProductsRead(appConfig.apiBaseUrl);
const membersRead = createFetchReferralMembersRead(appConfig.apiBaseUrl);
const bindingsRead = createFetchReferralBindingsRead(appConfig.apiBaseUrl);
const commissionsRead = createFetchReferralCommissionsRead(appConfig.apiBaseUrl);
const withdrawalsRead = createFetchReferralWithdrawalsRead(appConfig.apiBaseUrl);

export const referralKey = (context: ConsoleContext, view: ReferralView, cursor?: string) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, referralOperation(view), cursor ?? null, 50] as const);

export function referralOperation(view: ReferralView): string {
  return `referral.${view === 'members' ? 'members' : view}.read`;
}

export function referralPermission(view: ReferralView): string {
  if (view === 'settings') return 'referral.setting.read';
  if (view === 'products') return 'referral.product.read';
  if (view === 'members') return 'referral.member.read';
  if (view === 'bindings') return 'referral.binding.read';
  if (view === 'commissions') return 'referral.commission.read';
  return 'referral.withdrawal.readself';
}

export async function readReferral(context: ConsoleContext, view: ReferralView, cursor: string | undefined, signal: AbortSignal): Promise<ReferralPage> {
  const request = consoleRequest(context.scope, signal, context.session.accessVersion);
  const query = { limit: 50, ...(cursor === undefined ? {} : { cursor }) };
  if (view === 'settings') {
    const item = (await settingsRead({}, request)) as unknown as ReferralSetting;
    return Object.freeze({ view, items: Object.freeze([item]), count: 1 });
  }
  if (view === 'products') return page(view, (await productsRead({ query }, request)) as unknown as Page<ReferralProduct>);
  if (view === 'members') return page(view, (await membersRead({ query }, request)) as unknown as Page<ReferralMember>);
  if (view === 'bindings') return page(view, (await bindingsRead({ query }, request)) as unknown as Page<ReferralBinding>);
  if (view === 'commissions') return page(view, (await commissionsRead({ query }, request)) as unknown as Page<ReferralCommission>);
  return page(view, (await withdrawalsRead({ query }, request)) as unknown as Page<ReferralWithdrawal>);
}

interface Page<T> {
  readonly items: readonly T[];
  readonly count: number;
  readonly nextCursor?: string | undefined;
}
function page<TView extends Exclude<ReferralView, 'settings'>, TItem>(view: TView, value: Page<TItem>) {
  return Object.freeze({ view, items: Object.freeze([...value.items]), count: value.count, ...(value.nextCursor === undefined ? {} : { nextCursor: value.nextCursor }) });
}
