import type { FormEventHandler } from 'react';
import { formatMinor } from '../../../shared/format/Money';
import type { ReferralLink, ReferralWithdrawal } from '../model/Referral';

export function ReferralActions({
  availableMinor,
  currency,
  withdrawals,
  link,
  busy,
  loading,
  hasMore,
  apply,
  withdraw,
  generate,
  share,
  closeLink,
  loadMore,
}: Readonly<{
  availableMinor: number;
  currency: string;
  withdrawals: readonly ReferralWithdrawal[];
  link: ReferralLink | null;
  busy: string | null;
  loading: boolean;
  hasMore: boolean;
  apply: FormEventHandler<HTMLFormElement>;
  withdraw: FormEventHandler<HTMLFormElement>;
  generate: () => void;
  share: () => void;
  closeLink: () => void;
  loadMore: () => void;
}>) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="rounded-2xl border bg-surface p-4 shadow-sm">
        <h2 className="font-black">推荐官与专属链接</h2>
        <p className="mt-1 text-xs text-muted">提交申请后由企业审核；链接只在你主动生成时展示。</p>
        <form onSubmit={apply} className="mt-3 grid gap-2">
          <input name="displayName" required maxLength={100} placeholder="展示名称" className="rounded-lg border px-3 py-2 text-xs" />
          <input name="mobile" required inputMode="tel" autoComplete="tel" maxLength={20} placeholder="联系手机号" className="rounded-lg border px-3 py-2 text-xs" />
          <textarea name="reason" required maxLength={500} placeholder="申请理由" className="min-h-20 rounded-lg border px-3 py-2 text-xs" />
          <button type="submit" disabled={busy !== null} className="rounded-lg border border-brand bg-brand-light py-2 text-xs font-bold text-brand disabled:opacity-50">
            {busy === 'apply' ? '正在提交…' : '提交推荐官申请'}
          </button>
        </form>
        <button type="button" disabled={busy !== null} onClick={generate} className="mt-2 w-full rounded-lg bg-[var(--sw-brand)] py-2 text-xs font-bold text-inverse disabled:opacity-50">
          {busy === 'link' ? '正在生成…' : '生成我的推荐链接'}
        </button>
        {link ? (
          <div className="mt-3 rounded-xl bg-brand-light p-3 text-xs">
            <b>专属链接已生成</b>
            <p className="mt-1 break-all text-muted">有效至 {new Date(link.expiresAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={share} className="rounded-lg bg-[var(--sw-brand)] px-3 py-2 font-bold text-inverse">
                分享或复制
              </button>
              <button type="button" onClick={closeLink} className="rounded-lg border px-3 py-2 font-bold">
                关闭并清除
              </button>
            </div>
          </div>
        ) : null}
      </section>
      <section className="rounded-2xl border bg-surface p-4 shadow-sm">
        <h2 className="font-black">收益提现</h2>
        <p className="mt-1 text-xs text-muted">可提现 ¥{formatMinor(availableMinor)}；账户标识仅用于本次申请并由服务端受控处理。</p>
        <form onSubmit={withdraw} className="mt-3 grid gap-2">
          <input name="amount" required inputMode="decimal" placeholder="提现金额（元）" className="rounded-lg border px-3 py-2 text-xs" />
          <input name="accountRef" required maxLength={500} autoComplete="off" placeholder="收款账户标识" className="rounded-lg border px-3 py-2 text-xs" />
          <button type="submit" disabled={busy !== null || availableMinor <= 0} className="rounded-lg bg-[var(--sw-brand)] py-2 text-xs font-bold text-inverse disabled:opacity-50">
            {busy === 'withdraw' ? '正在提交…' : `安全提交 ${currency} 提现`}
          </button>
        </form>
        <div className="mt-3 divide-y">
          {withdrawals.map((item) => (
            <article key={item.id} className="flex justify-between gap-3 py-3 text-xs">
              <span>
                {withdrawalLabel(item.status)}
                <small className="mt-1 block text-muted">{new Date(item.requestedAt).toLocaleDateString('zh-CN')}</small>
              </span>
              <b>¥{formatMinor(item.amountMinor)}</b>
            </article>
          ))}
          {withdrawals.length === 0 ? <p className="py-6 text-center text-xs text-muted">暂无提现申请</p> : null}
        </div>
        {hasMore ? (
          <button type="button" disabled={loading} onClick={loadMore} className="w-full rounded-lg border py-2 text-xs font-bold text-brand">
            {loading ? '正在加载…' : '加载更多提现记录'}
          </button>
        ) : null}
      </section>
    </div>
  );
}

function withdrawalLabel(value: string) {
  return ({ requested: '已申请', processing: '处理中', paid: '已到账', failed: '处理失败' } as Record<string, string>)[value] ?? '处理中';
}
