import type { CockpitSales } from './CockpitSchema';

export interface CockpitHeroProps {
  readonly sales: CockpitSales;
  readonly perspective?: Readonly<{ name: string; channel: string }>;
}

export function CockpitHero({ sales, perspective }: CockpitHeroProps) {
  const period = sales.period;
  return (
    <section className="cockpithero" aria-labelledby="cockpittitle">
      <div>
        <p className="cockpiteyebrow">{perspective === undefined ? 'BUSINESS PERFORMANCE' : 'SUPPLIER PERFORMANCE'}</p>
        <h1 id="cockpittitle">{perspective === undefined ? '经营驾驶舱' : `${perspective.name}经营驾驶舱`}</h1>
        <p className="cockpitconclusion">{sales.conclusion ?? '经营结论等待服务端权威读模型。'}</p>
        <p className="cockpitperiod">{perspective === undefined ? '' : `${perspective.channel} · `}{period === undefined ? '统计周期未返回' : `${period.from}—${period.to}`}</p>
      </div>
      <svg className="cockpitheroicon" viewBox="0 0 92 72" role="img" aria-label="经营趋势">
        <path d="M10 57 31 36l14 12 29-31" />
        <path d="M61 17h13v13M10 65h70" />
      </svg>
    </section>
  );
}
