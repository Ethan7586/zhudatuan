import { CreditCard, Gift } from 'lucide-react';
import type { Quote } from '../model/Quote';
import { formatMinor } from '../../../shared/format/Money';

export function TenderPanel({ quote }: { readonly quote: Quote | null }) {
  if (!quote) return <div className="rounded border border-brand-light bg-brand-light p-2 text-xs text-brand">生成 Quote 后，系统会展示服务端确定的福利、卡券和个人支付拆分。</div>;
  return (
    <div className="space-y-2 text-xs">
      {quote.tenders.map((tender, index) => (
        <div key={`${tender.kind}:${tender.reference ?? index}`} className="flex items-center justify-between rounded border border-brand bg-brand-light/80 p-2">
          <span className="flex items-center gap-1.5 font-bold text-content">
            {tender.kind === 'benefit' ? <Gift className="h-3.5 w-3.5 text-success" /> : <CreditCard className="h-3.5 w-3.5 text-brand" />}
            {tenderName(tender.kind)}
          </span>
          <b className="text-[var(--sw-brand-dark)]">¥{formatMinor(tender.amountMinor)}</b>
        </div>
      ))}
    </div>
  );
}

function tenderName(kind: Quote['tenders'][number]['kind']): string {
  if (kind === 'benefit') return '企业福利账户';
  if (kind === 'voucher') return '卡券抵扣';
  return '微信补差支付';
}
