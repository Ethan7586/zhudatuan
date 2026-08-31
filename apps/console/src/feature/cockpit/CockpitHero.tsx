import type { CockpitSales } from './CockpitSchema';
import { useRouteTitle } from '../../shared/ui/RouteTitle';

export interface CockpitHeroProps {
  readonly sales: CockpitSales;
}

export function CockpitHero({ sales }: CockpitHeroProps) {
  const period = sales.period;
  const title = useRouteTitle('经营驾驶舱');
  return (
    <section className="cockpithero" aria-labelledby="cockpittitle">
      <div>
        <p className="cockpiteyebrow">BUSINESS PERFORMANCE</p>
        <h1 id="cockpittitle">{title}</h1>
        <p className="cockpitconclusion">{sales.conclusion ?? '经营结论等待服务端权威读模型。'}</p>
        <p className="cockpitperiod">{period === undefined ? '统计周期未返回' : `${period.from}—${period.to}`}</p>
      </div>
      <svg className="cockpitheroicon" viewBox="0 0 92 72" role="img" aria-label="经营趋势">
        <path d="M10 57 31 36l14 12 29-31" />
        <path d="M61 17h13v13M10 65h70" />
      </svg>
    </section>
  );
}
