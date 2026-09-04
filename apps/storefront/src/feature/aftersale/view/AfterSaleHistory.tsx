import { Clock3 } from 'lucide-react';
import { chineseProviderLabel } from '@shop/presentation';
import { formatMinor } from '../../../shared/format/Money';
import { textValue } from '../../../shared/format/Text';
import type { AfterSalePage, AfterSaleState } from '../model/AfterSale';

export function AfterSaleHistory({ page }: Readonly<{ page: AfterSalePage | null }>) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-black">处理进度</h2>
      {page?.items.map((sale) => (
        <article key={sale.id} className="rounded-xl border border-edge bg-surface p-4 shadow-sm">
          <div className="flex justify-between">
            <b>{label(sale.state)}</b>
            <span>¥{formatMinor(sale.expectedRefundMinor)}</span>
          </div>
          <p className="mt-2 text-muted">{sale.description}</p>
          <div className="mt-3 rounded-lg bg-subtle p-2">
            <b>预计退款拆分</b>
            {sale.expectedRefund.tenders.map((tender, index) => (
              <div key={`${tender.kind}:${tender.reference ?? index}`} className="mt-1 flex justify-between">
                <span>{tenderLabel(tender.kind)}</span>
                <span>¥{formatMinor(tender.amountMinor)}</span>
              </div>
            ))}
          </div>
          {sale.returns.map((returned) => (
            <div key={returned.id} className="mt-3 rounded-lg border border-brand-light p-2">
              <b>退货指引 · {returned.provider ? chineseProviderLabel(returned.provider) : '平台自营'}</b>
              <p className="mt-1 text-muted">
                {returned.providerReference ? `外部退货单 ${returned.providerReference}` : '平台退货单'}
                {returned.trackingNumber ? ` · 运单 ${returned.trackingNumber}` : ''}
              </p>
              <p className="text-muted">{textValue(returned.instruction.address ?? returned.instruction.message)}</p>
            </div>
          ))}
          <ol className="mt-4 space-y-3 border-l-2 border-brand-light pl-4">
            {sale.timeline.map((item) => (
              <li key={item.sequence}>
                <b>{label(item.state)}</b>
                <p className="text-muted">{evidenceText(item.evidence)}</p>
                <p className="text-muted">{new Date(item.occurredAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
              </li>
            ))}
          </ol>
        </article>
      ))}
      {page && page.items.length === 0 ? (
        <div role="status" className="grid min-h-28 place-items-center rounded-lg bg-subtle text-muted">
          <Clock3 size={22} />
          <span>尚未提交售后申请</span>
        </div>
      ) : null}
    </div>
  );
}

function label(state: AfterSaleState): string {
  return ({ applied: '已申请', reviewing: '审核中', approved: '已批准', returning: '退货中', received: '已收货', refunding: '退款中', resolved: '已完成', rejected: '未通过' } as const)[state];
}
function tenderLabel(kind: string): string {
  return ({ wechat: '微信支付', benefit: '福利账户', voucher: '卡券' } as Record<string, string>)[kind] ?? '其他支付方式';
}
function evidenceText(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const returns = Array.isArray((value as Record<string, unknown>).returns) ? ((value as Record<string, unknown>).returns as Array<Record<string, unknown>>) : [];
  return returns
    .map((returned) =>
      [
        returned.provider ? `供应商 ${textValue(returned.provider)}` : '平台退货',
        returned.trackingNumber ? `运单 ${textValue(returned.trackingNumber)}` : '',
        returned.instruction && typeof returned.instruction === 'object' ? textValue((returned.instruction as Record<string, unknown>).address) : '',
      ]
        .filter(Boolean)
        .join(' · ')
    )
    .join('；');
}
