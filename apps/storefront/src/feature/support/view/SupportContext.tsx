import { BriefcaseBusiness, WalletCards } from 'lucide-react';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import type { SupportContext as Context } from '../model/Message';
import { formatMinor } from '../../../shared/format/Money';

export function SupportContext({ context }: Readonly<{ context: Context }>) {
  if (context.orders.length === 0 && context.benefits.length === 0) return null;
  return (
    <aside className="border-b border-edge bg-subtle p-3 text-xs" aria-label="客服业务上下文">
      <p className="font-black">客服已获授权查看的业务上下文</p>
      <div className="mt-2 flex gap-3 overflow-x-auto">
        {context.orders.map((item) => <div key={item.id} className="min-w-52 rounded-lg border bg-surface p-2"><b className="flex items-center gap-1"><BriefcaseBusiness size={14} />{chineseReference('订单', item.number)}</b><p className="mt-1 text-muted">{chineseDomainLabel(item.state, '订单处理中')} · ¥{formatMinor(item.totalMinor)}</p></div>)}
        {context.benefits.map((item) => <div key={item.id} className="min-w-52 rounded-lg border bg-surface p-2"><b className="flex items-center gap-1"><WalletCards size={14} />{chineseDomainLabel(item.kind, '福利账户')}</b><p className="mt-1 text-muted">{chineseDomainLabel(item.state, '状态更新中')} · 可用 ¥{formatMinor(item.remainingMinor)}</p></div>)}
      </div>
    </aside>
  );
}
