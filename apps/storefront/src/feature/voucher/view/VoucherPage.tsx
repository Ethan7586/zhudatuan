import { CircleAlert, History, LoaderCircle, TicketCheck } from 'lucide-react';
import { chineseReference } from '@shop/presentation';
import { StorefrontStepup } from '../../security/public';
import type { Voucher } from '../model/Voucher';
import type { Redemption } from '../model/Redemption';
import type { useVoucherViewModel } from '../viewmodel/VoucherViewModel';

export function VoucherPage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useVoucherViewModel> }>) {
  const { state, vouchers, redemptions, verification, message, actions } = viewmodel;
  return (
    <section className="sw-web-container mx-auto max-w-[1200px] px-3 py-5 text-xs">
      <StorefrontStepup
        open={verification}
        onClose={actions.closeVerification}
        onVerified={actions.verified}
      />
      <header className="mb-4">
        <p className="font-bold tracking-[.18em] text-[var(--sw-brand)]">智慧翼 · 卡券中心</p>
        <h1 className="mt-1 text-xl font-black">卡券中心</h1>
        <p className="mt-1 text-gray-500">展示服务端绑定卡券、剩余金额、有效期及真实核销记录。</p>
      </header>
      {message ? (
        <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 font-bold text-red-700">
          <CircleAlert size={16} />
          {message}
        </div>
      ) : null}
      {state === 'denied' ? (
        <div role="status" className="mb-3 rounded-lg bg-blue-50 p-3 font-bold text-blue-800">
          完成二次验证后即可查看敏感的卡券核销记录。
        </div>
      ) : null}
      {state === 'loading' ? <State text="正在读取卡券…" /> : <VoucherContent vouchers={vouchers} redemptions={redemptions} />}
    </section>
  );
}

function VoucherContent({ vouchers, redemptions }: Readonly<{ vouchers: readonly Voucher[]; redemptions: readonly Redemption[] }>) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-base font-black">
          <TicketCheck size={18} />
          我的卡券
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {vouchers.map((item) => (
            <article key={item.id} className="relative overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-700 to-indigo-900 p-4 text-white shadow-sm">
              <span className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" />
              <p className="relative text-blue-100">{stateLabel(item.state)}</p>
              <h3 className="relative mt-1 text-base font-black">{item.name}</h3>
              <p className="relative mt-5 text-2xl font-black">{money(item.remainingMinor)}</p>
              <p className="relative mt-1 text-blue-100">
                初始 {money(item.initialMinor)} · 有效期至 {date(item.expiresAt)}
              </p>
              <p className="relative mt-3 truncate text-[10px] text-blue-200">{chineseReference('卡券', item.id)}</p>
            </article>
          ))}
          {vouchers.length === 0 ? <State text="暂无可用卡券" /> : null}
        </div>
      </div>
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-base font-black">
          <History size={18} />
          核销记录
        </h2>
        <div className="divide-y rounded-xl border bg-white px-4 shadow-sm">
          {redemptions.map((item) => (
            <article key={item.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <b>{money(item.amountMinor)}</b>
                <p className="mt-1 text-gray-400">
                  {dateTime(item.redeemedAt)} · {item.orderId ? chineseReference('订单', item.orderId) : '线下核销'}
                </p>
              </div>
              <div className="text-right">
                <span className="font-bold text-[var(--sw-brand)]">{receiptLabel(item.state)}</span>
                {item.reversedMinor ? <p className="mt-1 text-gray-400">已冲正 {money(item.reversedMinor)}</p> : null}
              </div>
            </article>
          ))}
          {redemptions.length === 0 ? <p className="py-10 text-center text-gray-400">暂无核销记录</p> : null}
        </div>
      </div>
    </div>
  );
}
function State({ text }: { readonly text: string }) {
  return (
    <div role="status" className="flex min-h-32 items-center justify-center gap-2 rounded-xl border border-dashed bg-white text-gray-400">
      <LoaderCircle className="animate-spin" size={17} />
      {text}
    </div>
  );
}
function money(value: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value / 100);
}
function date(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
}
function dateTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}
function stateLabel(value: string) {
  return ({ inactive: '待激活', active: '可使用', held: '使用中', redeemed: '已核销', reversed: '已冲正', disabled: '已停用', expired: '已过期', void: '已作废' } as Record<string, string>)[value] ?? '待识别状态';
}
function receiptLabel(value: string) {
  return ({ redeemed: '已核销', partially_reversed: '部分冲正', reversed: '已冲正' } as Record<string, string>)[value] ?? '待识别状态';
}
