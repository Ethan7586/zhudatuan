import { CircleAlert, History, LoaderCircle, TicketCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { productionError } from '../../../shared/failure/Failure';
import { useSession } from '../../../shared/runtime/SessionContext';
import { StorefrontStepup } from '../../security/public';
import { readVouchers } from '../application/ReadVouchers';
import { readRedemptions } from '../application/ReadRedemptions';
import { voucherQuery } from '../application/VoucherQuery';

export function VoucherPage() {
  const session = useSession();
  const scope = session.scope || 'guest';
  const [verification, setVerification] = useState(false);
  const query = useQuery({
    queryKey: voucherQuery(scope),
    queryFn: async ({ signal }) => {
      const current = required(session.session);
      const [vouchers, redemptions] = await Promise.all([readVouchers(current, signal), readRedemptions(current, signal)]);
      return { vouchers, redemptions };
    },
    enabled: session.status === 'authenticated',
    retry: false,
  });
  const failure = query.error ? productionError(query.error) : null;
  useEffect(() => {
    if (failure?.code === 'STEPUP_REQUIRED') setVerification(true);
  }, [failure?.code]);
  return (
    <section className="sw-web-container mx-auto max-w-[1200px] px-3 py-5 text-xs">
      <StorefrontStepup
        open={verification}
        onClose={() => setVerification(false)}
        onVerified={() => {
          setVerification(false);
          void query.refetch();
        }}
      />
      <header className="mb-4">
        <p className="font-bold tracking-[.18em] text-[var(--sw-brand)]">SMART WING VOUCHER</p>
        <h1 className="mt-1 text-xl font-black">卡券中心</h1>
        <p className="mt-1 text-gray-500">展示服务端绑定卡券、剩余金额、有效期及真实核销记录。</p>
      </header>
      {failure && failure.code !== 'STEPUP_REQUIRED' ? (
        <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 font-bold text-red-700">
          <CircleAlert size={16} />
          {failure.message}
        </div>
      ) : null}
      {failure?.code === 'STEPUP_REQUIRED' ? (
        <div role="status" className="mb-3 rounded-lg bg-blue-50 p-3 font-bold text-blue-800">
          完成二次验证后即可查看敏感的卡券核销记录。
        </div>
      ) : null}
      {query.isPending ? <State text="正在读取卡券…" /> : query.data ? <VoucherContent vouchers={query.data.vouchers} redemptions={query.data.redemptions} /> : null}
    </section>
  );
}

function VoucherContent({ vouchers, redemptions }: Readonly<{ vouchers: Awaited<ReturnType<typeof readVouchers>>; redemptions: Awaited<ReturnType<typeof readRedemptions>> }>) {
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
              <p className="relative mt-3 truncate text-[10px] text-blue-200">{item.id}</p>
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
                  {dateTime(item.redeemedAt)} · {item.orderId ?? '线下核销'}
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
function required<T>(value: T | null): T {
  if (!value) throw new Error('AUTHENTICATION_REQUIRED');
  return value;
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
  return ({ inactive: '待激活', active: '可使用', held: '使用中', redeemed: '已核销', reversed: '已冲正', disabled: '已停用', expired: '已过期', void: '已作废' } as Record<string, string>)[value] ?? value;
}
function receiptLabel(value: string) {
  return ({ redeemed: '已核销', partially_reversed: '部分冲正', reversed: '已冲正' } as Record<string, string>)[value] ?? value;
}
