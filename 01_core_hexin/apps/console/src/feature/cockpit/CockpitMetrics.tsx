import type { CockpitSales } from './CockpitSchema';

export function CockpitMetrics({ sales, operations }: Readonly<{
  sales: CockpitSales;
  operations?: Readonly<{ pendingFulfillmentCount: number; payableSettlementCents: number }>;
}>) {
  const deltas = sales.deltas;
  const metrics = operations === undefined ? [
    { label: '净成交额', value: formatMinor(sales.periodSalesCents), delta: ratio(deltas?.netSalesRatio), tone: growthTone(deltas?.netSalesRatio) },
    { label: '支付订单', value: formatCount(sales.periodPaidOrderCount), delta: ratio(deltas?.paidOrdersRatio), tone: growthTone(deltas?.paidOrdersRatio) },
    { label: '客单价', value: formatMinor(sales.averageOrderValueCents), delta: ratio(deltas?.averageOrderRatio), tone: growthTone(deltas?.averageOrderRatio) },
    { label: '退款率', value: percent(deltas?.refundRate), delta: points(deltas?.refundRateDeltaPoints), tone: inverseTone(deltas?.refundRateDeltaPoints) },
  ] : [
    { label: '供应成交额', value: formatMinor(sales.periodSalesCents), delta: ratio(deltas?.netSalesRatio), tone: growthTone(deltas?.netSalesRatio) },
    { label: '供应订单', value: formatCount(sales.periodPaidOrderCount), delta: ratio(deltas?.paidOrdersRatio), tone: growthTone(deltas?.paidOrdersRatio) },
    { label: '待履约', value: formatCount(operations.pendingFulfillmentCount), delta: operations.pendingFulfillmentCount > 0 ? '需要处理' : '当前无待办', tone: operations.pendingFulfillmentCount > 0 ? 'negative' as const : 'positive' as const },
    { label: '待结算', value: formatMinor(operations.payableSettlementCents), delta: '按供应协议归集', tone: 'neutral' as const },
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

function formatMinor(value: number): string {
  const amount = value / 100;
  return `${amount < 0 ? '-' : ''}¥${groupDigits(Math.abs(amount).toFixed(2))}`;
}

function formatCount(value: number): string {
  return groupDigits(Math.abs(value).toFixed(0)).replace(/^/, value < 0 ? '-' : '');
}

function groupDigits(value: string): string {
  const [integer, fraction] = value.split('.');
  const grouped = (integer ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}
