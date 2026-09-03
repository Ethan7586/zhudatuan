import { CreditCard, Gift } from 'lucide-react';
import type { Quote } from '../model/Quote';
import { formatMinor } from '../../../shared/format/Money';

export function TenderPanel({ quote }: { readonly quote: Quote | null }) {
  if (!quote) return <div className="rounded border border-blue-100 bg-blue-50 p-2 text-xs text-blue-700">提交时由服务端按福利、卡券、个人支付的固定顺序生成权威支付计划。</div>;
  return (
    <div className="space-y-2 text-xs">
      {quote.tenders.map((tender, index) => (
        <div key={`${tender.kind}:${tender.reference ?? index}`} className="flex items-center justify-between rounded border border-blue-200 bg-blue-50/80 p-2">
          <span className="flex items-center gap-1.5 font-bold text-gray-800">
            {tender.kind === 'benefit' ? <Gift className="h-3.5 w-3.5 text-emerald-600" /> : <CreditCard className="h-3.5 w-3.5 text-blue-600" />}
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
