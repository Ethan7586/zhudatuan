import { useId, useMemo, useState } from 'react';
import type { BusinessEvent, CockpitSales, Trend } from './CockpitSchema';

type Grain = 'day' | 'week';
type Measure = 'sales' | 'orders';

export function CockpitTrend({ sales }: Readonly<{ sales: CockpitSales }>) {
  const [grain, setGrain] = useState<Grain>('day');
  const [measure, setMeasure] = useState<Measure>('sales');
  const chartId = useId().replace(/:/g, '');
  const rows = grain === 'week' && sales.weeklyTrend !== undefined ? sales.weeklyTrend : sales.trend;
  const geometry = useMemo(() => chartGeometry(rows), [rows]);
  return (
    <section className="cockpitcard cockpittrend" aria-labelledby={`${chartId}title`}>
      <header>
        <div>
          <h2 id={`${chartId}title`}>交易与订单趋势</h2>
          <div className="measuretabs" role="tablist" aria-label="趋势指标">
            <button type="button" role="tab" aria-selected={measure === 'sales'} onClick={() => setMeasure('sales')}>
              净成交额
            </button>
            <button type="button" role="tab" aria-selected={measure === 'orders'} onClick={() => setMeasure('orders')}>
              支付订单
            </button>
          </div>
        </div>
        <div className="grainbuttons" role="group" aria-label="趋势粒度">
          <button type="button" aria-pressed={grain === 'day'} onClick={() => setGrain('day')}>
            按日
          </button>
          <button type="button" aria-pressed={grain === 'week'} disabled={sales.weeklyTrend === undefined} onClick={() => setGrain('week')}>
            按周
          </button>
        </div>
      </header>
      {rows.length === 0 ? <p className="cockpitempty">暂无权威趋势数据</p> : <TrendGraphic rows={rows} events={sales.events ?? []} geometry={geometry} measure={measure} />}
    </section>
  );
}

interface Geometry {
  readonly points: string;
  readonly sales: readonly number[];
  readonly orders: readonly number[];
  readonly x: readonly number[];
}

function TrendGraphic({
  rows,
  events,
  geometry,
  measure,
}: Readonly<{
  rows: readonly Trend[];
  events: readonly BusinessEvent[];
  geometry: Geometry;
  measure: Measure;
}>) {
  return (
    <svg className="cockpitchart" viewBox="0 0 560 224" role="img" aria-label="净成交额折线与支付订单柱形组合趋势">
      <title>交易与订单趋势</title>
      {[42, 82, 122, 162].map((y) => (
        <line key={y} className="chartgrid" x1="42" x2="542" y1={y} y2={y} />
      ))}
      {geometry.orders.map((height, index) => (
        <rect key={rows[index]?.date} className="orderbar" opacity={measure === 'orders' ? 0.75 : 0.28} x={(geometry.x[index] ?? 0) - 5} y={176 - height} width="10" height={height} rx="2" />
      ))}
      <polyline className="salesline" opacity={measure === 'sales' ? 1 : 0.42} points={geometry.points} />
      {eventMarkers(rows, events, geometry).map((marker) => (
        <g key={marker.id} className={marker.kind === 'warning' ? 'eventwarning' : 'eventnormal'}>
          <line x1={marker.x} x2={marker.x} y1="28" y2={marker.y - 4} />
          <circle cx={marker.x} cy={marker.y} r="4" />
          <text x={marker.x} y="14" textAnchor="middle">
            {marker.label}
          </text>
          <text x={marker.x} y="26" textAnchor="middle">
            {marker.title}
          </text>
        </g>
      ))}
      {axisLabels(rows).map(({ label, index }) => (
        <text key={`${label}${index}`} className="axislabel" x={geometry.x[index]} y="196" textAnchor="middle">
          {label}
        </text>
      ))}
      <g className="chartlegend">
        <line x1="44" x2="66" y1="214" y2="214" />
        <text x="72" y="218">
          净成交额（元）
        </text>
        <rect x="170" y="208" width="10" height="8" rx="2" />
        <text x="186" y="218">
          支付订单（单）
        </text>
      </g>
    </svg>
  );
}

function chartGeometry(rows: readonly Trend[]): Geometry {
  const maxSales = Math.max(...rows.map((row) => row.salesCents), 1);
  const maxOrders = Math.max(...rows.map((row) => row.orderCount), 1);
  const step = rows.length <= 1 ? 0 : 480 / (rows.length - 1);
  const x = rows.map((_, index) => 52 + step * index);
  const sales = rows.map((row) => 162 - (row.salesCents / maxSales) * 118);
  const orders = rows.map((row) => (row.orderCount / maxOrders) * 74);
  return { x, sales, orders, points: x.map((value, index) => `${value.toFixed(1)},${(sales[index] ?? 0).toFixed(1)}`).join(' ') };
}

function eventMarkers(rows: readonly Trend[], events: readonly BusinessEvent[], geometry: Geometry) {
  return events.flatMap((event) => {
    if (event.date === undefined) return [];
    const index = rows.findIndex((row) => row.date === event.date);
    if (index < 0) return [];
    return [{ id: event.id, kind: event.kind, x: geometry.x[index] ?? 0, y: geometry.sales[index] ?? 0, label: monthDay(event.date), title: event.title.replace(/^鸿泰(惠民通|甄选)/, '') }];
  });
}

function axisLabels(rows: readonly Trend[]) {
  const stride = Math.max(1, Math.ceil(rows.length / 6));
  return rows.flatMap((row, index) => (index % stride === 0 || index === rows.length - 1 ? [{ label: monthDay(row.date), index }] : []));
}

function monthDay(value: string): string {
  const match = /-(\d{2})-(\d{2})$/.exec(value);
  return match === null ? value : `${match[1]}-${match[2]}`;
}
