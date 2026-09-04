import { CircleAlert, Clock3, LoaderCircle, WalletCards } from 'lucide-react';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import type { useBenefitViewModel } from '../viewmodel/BenefitViewModel';

export function BenefitPage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useBenefitViewModel> }>) {
  const { state, accounts, ledger } = viewmodel;
  return (
    <section className="sw-web-container mx-auto max-w-[1200px] px-3 py-5 text-xs">
      <header className="mb-4">
        <p className="font-bold tracking-[.18em] text-[var(--sw-brand)]">智慧翼 · 福利账户</p>
        <h1 className="mt-1 text-xl font-black">福利账户</h1>
        <p className="mt-1 text-muted">余额、冻结金额、批次有效期和台账均取自权威福利账本。</p>
      </header>
      {state === 'failed' ? (
        <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-danger-surface p-3 font-bold text-danger-strong">
          <CircleAlert size={16} />
          福利账户加载失败
        </div>
      ) : null}
      {state === 'loading' ? (
        <State text="正在读取福利账户…" />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {accounts.map((item) => (
              <article key={item.id} className="rounded-xl border bg-surface p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-light text-[var(--sw-brand)]">
                    <WalletCards size={18} />
                  </span>
                  <span className="rounded-full bg-subtle px-2 py-1 text-muted">
                    {kind(item.kind)} · {status(item.status)}
                  </span>
                </div>
                <p className="mt-4 text-muted">可用余额</p>
                <p className="mt-1 text-2xl font-black text-content">{money(item.availableMinor, item.currency)}</p>
                <p className="mt-2 text-muted">
                  账面 {money(item.balanceMinor, item.currency)} · 冻结 {money(item.frozenMinor, item.currency)}
                </p>
                <div className="mt-4 space-y-2 border-t pt-3">
                  {item.lots.map((lot) => (
                    <div key={lot.id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-muted">{chineseReference('批次', lot.batch)}</span>
                      <span className="font-bold">{money(lot.remainingMinor, item.currency)}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
            {accounts.length === 0 ? <State text="暂无福利账户" /> : null}
          </div>
          <section className="mt-4 rounded-xl border bg-surface p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-black">
              <Clock3 size={18} />
              账户台账
            </h2>
            <div className="mt-3 divide-y">
              {ledger.map((item) => (
                <article key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <b>{item.description}</b>
                    <p className="mt-1 text-muted">
                      {dateTime(item.occurredAt)} · {chineseDomainLabel(item.referenceType, '福利业务')} · {chineseReference('业务', item.referenceId)}
                    </p>
                  </div>
                  <span className={`text-sm font-black ${item.amountMinor >= 0 ? 'text-success-strong' : 'text-content'}`}>
                    {item.amountMinor >= 0 ? '+' : ''}
                    {money(item.amountMinor, item.currency)}
                  </span>
                </article>
              ))}
              {ledger.length === 0 ? <p className="py-10 text-center text-muted">暂无账户流水</p> : null}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
function State({ text }: { readonly text: string }) {
  return (
    <div role="status" className="flex min-h-32 items-center justify-center gap-2 rounded-xl border border-dashed bg-surface text-muted">
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
  return chineseDomainLabel(value, '其他福利账户');
}
function status(value: string) {
  return value === 'active' ? '可用' : chineseDomainLabel(value);
}
