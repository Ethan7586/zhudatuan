import { formatCount, formatMinor } from '../../../shared/ui/Format';
import type { CockpitSales } from '../model/Cockpit';

export function CockpitMetrics({ sales }: Readonly<{ sales: CockpitSales }>) {
  const deltas = sales.deltas;
  const metrics = [
    { label: '净成交额', value: formatMinor(sales.periodSalesCents), detail: ratio(deltas.netSalesRatio), tone: growthTone(deltas.netSalesRatio) },
    { label: '支付订单', value: formatCount(sales.periodPaidOrderCount), detail: ratio(deltas.paidOrdersRatio), tone: growthTone(deltas.paidOrdersRatio) },
    { label: '平均客单价', value: formatMinor(sales.averageOrderValueCents), detail: ratio(deltas.averageOrderRatio), tone: growthTone(deltas.averageOrderRatio) },
    { label: '退款率', value: percent(deltas.refundRate), detail: points(deltas.refundRateDeltaPoints), tone: inverseTone(deltas.refundRateDeltaPoints) },
  ];
  return <section className="cockpitmetricband" aria-label="经营摘要">{metrics.map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small className={metric.tone === 'neutral' ? undefined : metric.tone === 'negative' ? 'isnegative' : 'ispositive'}>{metric.detail}</small></article>)}</section>;
}

function growthTone(value: number | null): 'positive' | 'negative' | 'neutral' { return value === null || value === 0 ? 'neutral' : value > 0 ? 'positive' : 'negative'; }
function inverseTone(value: number | null): 'positive' | 'negative' | 'neutral' { return value === null || value === 0 ? 'neutral' : value < 0 ? 'positive' : 'negative'; }
function ratio(value: number | null): string { return value === null ? '上期无可比数据' : `环比 ${value >= 0 ? '+' : '−'}${Math.abs(value * 100).toFixed(1)}%`; }
function points(value: number | null): string { return value === null ? '上期无可比数据' : value === 0 ? '较上期持平' : `${value > 0 ? '上升' : '下降'} ${Math.abs(value * 100).toFixed(1)} 个百分点`; }
function percent(value: number): string { return `${(value * 100).toFixed(1)}%`; }
