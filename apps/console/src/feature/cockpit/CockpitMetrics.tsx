import { formatCount, formatMinor } from '../../shared/ui/Format';
import type { CockpitSales } from './CockpitSchema';

export function CockpitMetrics({ sales }: Readonly<{ sales: CockpitSales }>) {
  const deltas = sales.deltas;
  const metrics = [
    { label: '净成交额', value: formatMinor(sales.periodSalesCents), delta: ratio(deltas?.netSalesRatio), tone: growthTone(deltas?.netSalesRatio) },
    { label: '支付订单', value: formatCount(sales.periodPaidOrderCount), delta: ratio(deltas?.paidOrdersRatio), tone: growthTone(deltas?.paidOrdersRatio) },
    { label: '客单价', value: formatMinor(sales.averageOrderValueCents), delta: ratio(deltas?.averageOrderRatio), tone: growthTone(deltas?.averageOrderRatio) },
    { label: '退款率', value: percent(deltas?.refundRate), delta: points(deltas?.refundRateDeltaPoints), tone: inverseTone(deltas?.refundRateDeltaPoints) },
  ];
  return (
    <section className="cockpitmetricband" aria-label="经营摘要">
      {metrics.map((metric) => <article key={metric.label}>
        <span>{metric.label}</span>
        <strong>{metric.value}</strong>
        <small className={metric.tone === 'neutral' ? undefined : metric.tone === 'negative' ? 'isnegative' : 'ispositive'}>{metric.delta}</small>
      </article>)}
    </section>
  );
}

function growthTone(value: number | undefined): 'positive' | 'negative' | 'neutral' {
  return value === undefined ? 'neutral' : value >= 0 ? 'positive' : 'negative';
}

function inverseTone(value: number | undefined): 'positive' | 'negative' | 'neutral' {
  return value === undefined ? 'neutral' : value <= 0 ? 'positive' : 'negative';
}

function ratio(value: number | undefined): string {
  return value === undefined ? '环比待返回' : `环比 ${signedPercent(value)}`;
}

function points(value: number | undefined): string {
  if (value === undefined) return '变化待返回';
  return `${value >= 0 ? '上升' : '下降'} ${Math.abs(value * 100).toFixed(1)} 个百分点`;
}

function percent(value: number | undefined): string {
  return value === undefined ? '—' : `${(value * 100).toFixed(1)}%`;
}

function signedPercent(value: number): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value * 100).toFixed(1)}%`;
}
