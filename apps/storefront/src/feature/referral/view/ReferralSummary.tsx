import { formatMinor } from '../../../shared/format/Money';
import type { ReferralCommission } from '../model/Referral';
import { chineseReference } from '@shop/presentation';

export function ReferralSummary({
  summary,
  commissions,
  loading,
  hasMore,
  loadMore,
}: Readonly<{
  summary: Readonly<{ availableMinor: number; pendingMinor: number; settledMinor: number; reversedMinor: number; currency: string }>;
  commissions: readonly ReferralCommission[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
}>) {
  const cards = [
    ['可提现', summary.availableMinor],
    ['待结算', summary.pendingMinor],
    ['累计结算', summary.settledMinor],
    ['已冲正', summary.reversedMinor],
  ] as const;
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={label} className="rounded-2xl border bg-surface p-3 shadow-sm">
            <span className="text-xs text-muted">{label}</span>
            <b className="mt-1 block text-lg">¥{formatMinor(value)}</b>
          </article>
        ))}
      </div>
      <div className="rounded-2xl border bg-surface p-4 shadow-sm">
        <h2 className="font-black">收益明细</h2>
        <div className="mt-2 divide-y">
          {commissions.map((item) => (
            <article key={item.id} className="flex items-center justify-between gap-3 py-3 text-xs">
              <div>
                <b>
                  {item.kind === 'reward' ? '推荐奖励' : '推广佣金'} · {statusLabel(item.status)}
                </b>
                <p className="mt-1 text-muted">
                  {chineseReference('订单', item.orderId)} · {format(item.availableAt)}
                </p>
              </div>
              <b className={item.amountMinor - item.reversedMinor >= 0 ? 'text-success-strong' : 'text-danger'}>¥{formatMinor(item.amountMinor - item.reversedMinor)}</b>
            </article>
          ))}
          {commissions.length === 0 ? <p className="py-8 text-center text-xs text-muted">暂无收益明细</p> : null}
        </div>
        {hasMore ? (
          <button type="button" disabled={loading} onClick={loadMore} className="w-full rounded-lg border py-2 text-xs font-bold text-brand disabled:opacity-50">
            {loading ? '正在加载…' : '加载更多收益'}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function statusLabel(value: string) {
  return ({ pending: '待结算', available: '可提现', settled: '已结算', reversed: '已冲正' } as Record<string, string>)[value] ?? '处理中';
}
function format(value: string | null) {
  return value ? new Date(value).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '待确认';
}
