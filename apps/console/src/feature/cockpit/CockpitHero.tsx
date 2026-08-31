import type { CockpitSales } from './CockpitSchema';

export interface CockpitHeroProps {
  readonly sales: CockpitSales;
}

export function CockpitHero({ sales }: CockpitHeroProps) {
  const period = sales.period;
  return (
    <section className="cockpithero" aria-labelledby="cockpittitle">
      <div>
        <p className="cockpiteyebrow">BUSINESS PERFORMANCE</p>
        <h1 id="cockpittitle">经营驾驶舱</h1>
        <p className="cockpitconclusion">{sales.conclusion ?? '当前周期暂无经营数据，所有指标按 0 展示。'}</p>
        <p className="cockpitperiod">{period === undefined ? '当前统计周期' : `${period.from}—${period.to}`}</p>
      </div>
      <svg className="cockpitheroicon" viewBox="0 0 92 72" role="img" aria-label="经营趋势">
        <path d="M10 57 31 36l14 12 29-31" />
        <path d="M61 17h13v13M10 65h70" />
      </svg>
    </section>
  );
}
