import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { appConfig } from '../../shared/config/AppConfig';
import { ReferralBindingPageSchema, ReferralCommissionPageSchema, ReferralMemberPageSchema, ReferralProductPageSchema, ReferralSettingSchema, type ReferralRecord, type ReferralRecordPage, type ReferralView } from './ReferralSchema';

export const referralKey = (context: ConsoleContext, view: ReferralView, cursor?: string) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, referralOperation(view), view, cursor ?? null, 50] as const);

export function referralOperation(view: ReferralView): string {
  if (view === 'settings') return 'referral.settings.read';
  if (view === 'products') return 'referral.products.read';
  if (view === 'review') return 'referral.members.read';
  if (view === 'bindings') return 'referral.bindings.read';
  return 'referral.commissions.read';
}

export async function readReferral(context: ConsoleContext, view: ReferralView, cursor: string | undefined, signal: AbortSignal): Promise<ReferralRecordPage> {
  const pageQuery = { limit: 50, ...(cursor === undefined ? {} : { cursor }) };
  if (view === 'settings') {
    const setting = ReferralSettingSchema.parse(await readJson('/api/v1/referral/settings', undefined, signal));
    return single({
      id: setting.id,
      primary: setting.enabled ? '分销返佣已开启' : '分销返佣已关闭',
      secondary: setting.recruit_enabled ? '允许会员申请' : '暂停会员申请',
      state: setting.persisted === false ? 'unconfigured' : setting.enabled ? 'active' : 'inactive',
      detail: `${bindingLabel(setting.binding_mode, setting.binding_days)} · ${settlementLabel(setting.settle_trigger, setting.settle_delay_days)} · ${monthlyLabel(setting.withdraw_monthly_max)}`,
      rate: `${setting.review_required ? '申请需审核' : '申请自动通过'} · ${setting.reward_enabled ? '客户奖励开启' : '客户奖励关闭'}`,
      amountMinor: setting.withdraw_min_minor,
      withdrawableMinor: null,
      currency: 'CNY',
      occurredAt: setting.updated_at ?? null,
      version: setting.version,
    });
  }
  if (view === 'products') {
    const page = ReferralProductPageSchema.parse(await readJson('/api/v1/referral/products', pageQuery, signal));
    return mapPage(page, (row) => ({
      id: row.id,
      primary: row.title,
      secondary: `${row.code} · ${row.sku_id}`,
      state: row.enabled && row.listing_status === 'published' ? 'active' : row.enabled ? row.listing_status : 'inactive',
      detail: `${row.product_id} · ${row.listing_id}`,
      rate: `导购 ${formatBps(row.commission_bps)} · 客户 ${formatBps(row.reward_bps)}`,
      amountMinor: null,
      withdrawableMinor: null,
      currency: 'CNY',
      occurredAt: row.updated_at,
      version: row.version,
    }));
  }
  if (view === 'review') {
    const page = ReferralMemberPageSchema.parse(await readJson('/api/v1/referral/members', { ...pageQuery, state: 'pending' }, signal));
    return mapPage({ ...page, items: page.items.filter((row) => row.state === 'pending') }, (row) => ({
      id: row.id,
      primary: row.display_name,
      secondary: row.member_id,
      state: row.state,
      detail: row.inviter_display_name === null ? '无邀请人' : `邀请人：${row.inviter_display_name} · ${row.inviter_member_id}`,
      rate: row.approved_by === null ? '等待运营审核' : `审核人：${row.approved_by}`,
      amountMinor: null,
      withdrawableMinor: null,
      currency: 'CNY',
      occurredAt: row.created_at,
      version: row.version,
    }));
  }
  if (view === 'bindings') {
    const page = ReferralBindingPageSchema.parse(await readJson('/api/v1/referral/bindings', pageQuery, signal));
    return mapPage(page, (row) => ({
      id: row.id,
      primary: row.customer_display_name,
      secondary: `${row.customer_member_id} → ${row.referral_display_name}`,
      state: bindingState(row.expires_at),
      detail: `${row.referral_member_id} · ${row.expires_at === null ? '永久绑定' : `到期 ${row.expires_at}`}`,
      rate: '首次有效触点保留',
      amountMinor: null,
      withdrawableMinor: null,
      currency: 'CNY',
      occurredAt: row.bound_at,
      version: row.version,
    }));
  }
  const commissionQuery = { ...pageQuery, ...(view === 'withdrawals' ? { state: 'settled' } : {}) };
  const page = ReferralCommissionPageSchema.parse(await readJson('/api/v1/referral/commissions', commissionQuery, signal));
  const source = view === 'withdrawals' ? page.items.filter((row) => row.state === 'settled') : page.items;
  return mapPage({ ...page, items: source }, (row) => ({
    id: row.id,
    primary: row.beneficiary_display_name,
    secondary: `${row.order_id} · ${row.order_line_id}`,
    state: row.state,
    detail: `${row.sku_id} · 计佣基数 ${row.base_minor} 分 · 已冲正 ${row.reversed_minor} 分 · 已占用 ${row.claimed_minor} 分 · 待追回 ${row.recovery_minor} 分`,
    rate: `${row.kind === 'commission' ? '导购佣金' : '客户奖励'} ${formatBps(row.rate_bps)}`,
    amountMinor: Math.max(0, row.amount_minor - row.reversed_minor),
    withdrawableMinor: row.state === 'settled' ? row.withdrawable_minor : null,
    currency: row.currency,
    occurredAt: row.settled_at ?? row.eligible_at ?? row.created_at,
    version: row.version,
  }));
}

async function readJson(path: `/api/v1/${string}`, query: Readonly<Record<string, string | number>> | undefined, signal: AbortSignal): Promise<unknown> {
  const url = new URL(`${appConfig.apiBaseUrl}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    signal,
    headers: { accept: 'application/json', 'x-client-version': appConfig.clientVersion },
  });
  if (!response.ok) throw new Error(`REFERRAL_PREVIEW_READ_FAILED_${response.status}`);
  return response.json();
}

function mapPage<T>(page: Readonly<{ items: readonly T[]; count: number; nextCursor?: string | undefined }>, map: (item: T) => ReferralRecord): ReferralRecordPage {
  const items = Object.freeze(page.items.map(map));
  return Object.freeze({ items, count: items.length, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
}

function single(record: ReferralRecord): ReferralRecordPage {
  return Object.freeze({ items: Object.freeze([record]), count: 1 });
}

function formatBps(value: number): string {
  const percent = value / 100;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(2)}%`;
}

function bindingLabel(mode: 'permanent' | 'days', days: number | null): string {
  return mode === 'permanent' ? '永久绑定' : `绑定 ${days ?? 0} 天`;
}

function settlementLabel(trigger: 'on_paid' | 'on_received', delayDays: number): string {
  const triggerLabel = trigger === 'on_paid' ? '支付后' : '确认收货后';
  return `${triggerLabel}${delayDays === 0 ? '结算' : `${delayDays} 天结算`}`;
}

function monthlyLabel(maximum: number | null): string {
  return maximum === null ? '每月提现不限次数' : `每月最多提现 ${maximum} 次`;
}

function bindingState(expiresAt: string | null): string {
  return expiresAt !== null && Date.parse(expiresAt) <= Date.now() ? 'expired' : 'active';
}
