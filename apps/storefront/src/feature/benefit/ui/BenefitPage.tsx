import { CircleAlert, Clock3, LoaderCircle, WalletCards } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../../shared/runtime/SessionContext';
import { benefitQuery } from '../application/BenefitQuery';
import { readBenefits } from '../application/ReadBenefits';
import { readLedger } from '../application/ReadLedger';

export function BenefitPage() {
  const session = useSession();
  const scope = session.scope || 'guest';
  const query = useQuery({
    queryKey: benefitQuery(scope),
    queryFn: async ({ signal }) => {
      const current = required(session.session);
      const [accounts, ledger] = await Promise.all([readBenefits(current, signal), readLedger(current, signal)]);
      return { accounts, ledger };
    },
    enabled: session.status === 'authenticated',
  });
  return (
    <section className="sw-web-container mx-auto max-w-[1200px] px-3 py-5 text-xs">
      <header className="mb-4">
        <p className="font-bold tracking-[.18em] text-[var(--sw-brand)]">SMART WING BENEFIT</p>
        <h1 className="mt-1 text-xl font-black">福利账户</h1>
        <p className="mt-1 text-gray-500">余额、冻结金额、批次有效期和台账均取自权威福利账本。</p>
      </header>
      {query.isError ? (
        <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 font-bold text-red-700">
          <CircleAlert size={16} />
          福利账户加载失败
        </div>
      ) : null}
      {query.isPending ? (
        <State text="正在读取福利账户…" />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {query.data?.accounts.map((item) => (
              <article key={item.id} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-[var(--sw-brand)]">
                    <WalletCards size={18} />
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-500">
                    {kind(item.kind)} · {status(item.status)}
                  </span>
                </div>
                <p className="mt-4 text-gray-400">可用余额</p>
                <p className="mt-1 text-2xl font-black text-gray-900">{money(item.availableMinor, item.currency)}</p>
                <p className="mt-2 text-gray-500">
                  账面 {money(item.balanceMinor, item.currency)} · 冻结 {money(item.frozenMinor, item.currency)}
                </p>
                <div className="mt-4 space-y-2 border-t pt-3">
                  {item.lots.map((lot) => (
                    <div key={lot.id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-gray-500">{lot.batch}</span>
                      <span className="font-bold">{money(lot.remainingMinor, item.currency)}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
            {query.data?.accounts.length === 0 ? <State text="暂无福利账户" /> : null}
          </div>
          <section className="mt-4 rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-black">
              <Clock3 size={18} />
              账户台账
            </h2>
            <div className="mt-3 divide-y">
              {query.data?.ledger.map((item) => (
                <article key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <b>{item.description}</b>
                    <p className="mt-1 text-gray-400">
                      {dateTime(item.occurredAt)} · {item.referenceType} / {item.referenceId}
                    </p>
                  </div>
                  <span className={`text-sm font-black ${item.amountMinor >= 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                    {item.amountMinor >= 0 ? '+' : ''}
                    {money(item.amountMinor, item.currency)}
                  </span>
                </article>
              ))}
              {query.data?.ledger.length === 0 ? <p className="py-10 text-center text-gray-400">暂无账户流水</p> : null}
            </div>
          </section>
        </>
      )}
    </section>
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
function money(value: number, currency: string) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(value / 100);
}
function dateTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}
function kind(value: string) {
  return ({ welfare: '福利账户', meal: '餐补账户', allowance: '津贴账户' } as Record<string, string>)[value] ?? value;
}
function status(value: string) {
  return ({ active: '可用', frozen: '已冻结', closed: '已关闭' } as Record<string, string>)[value] ?? value;
}
