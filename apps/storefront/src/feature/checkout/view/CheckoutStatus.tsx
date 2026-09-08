import type { CheckoutState } from '../application/CheckoutState';

export function CheckoutStatus({ state }: Readonly<{ state: CheckoutState }>) {
  const content = message(state);
  if (!content) return null;
  return <div role={content.alert ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-xs ${content.alert ? 'border-warning bg-warning-surface text-warning-strong' : 'border-brand bg-brand-light text-brand-dark'}`}>{content.text}</div>;
}

function message(state: CheckoutState): Readonly<{ text: string; alert: boolean }> | null {
  if (state.phase === 'quoted') return { text: `服务端不可变报价已生成，有效期至 ${new Date(state.quote!.expiresAt).toLocaleString('zh-CN')}。请核对明细后确认下单。`, alert: false };
  if (state.phase === 'stale') return { text: '商品、地址、福利或卡券选择已变化，旧报价已撤下；请重新生成服务端报价。', alert: true };
  if (state.phase === 'expired') return { text: '这份服务端报价已经过期，不能继续下单。请重新报价以校验最新价格、资格和库存。', alert: true };
  if (state.phase === 'recovered') return { text: '已恢复上次服务端报价。一次性确认令牌不会重复展示，请重新报价后再确认下单。', alert: true };
  if (state.phase === 'rejected') return { text: `服务端未接受 ${state.quote!.rejections.length} 个商品，请按下方原因调整后重新报价。`, alert: true };
  if (state.phase === 'failed') return { text: '结算依赖读取失败。系统不会用本地数据猜测金额，请恢复后重试。', alert: true };
  return null;
}
