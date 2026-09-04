import type { CockpitPeriod } from '../model/Cockpit';

const periodLabels: Readonly<Record<CockpitPeriod, string>> = Object.freeze({ realtime: '实时', yesterday: '昨日', '7days': '近 7 日', '30days': '近 30 日' });

export function CockpitHero({ title, scope, period, application, conclusion }: Readonly<{ title: string; scope: string; period: CockpitPeriod; application: string; conclusion?: string }>) {
  return (
    <header className="cockpithero">
      <div>
        <p className="cockpiteyebrow">经营决策 · 权威投影</p>
        <h1>{title}</h1>
        <p className="cockpitconclusion">{conclusion ?? '集中查看交易、订单、商品与售后核心经营指标，所有数据均来自服务端报表投影。'}</p>
        <p className="cockpitperiod">
          当前范围：{scope} · 周期：{periodLabels[period]}
          {application ? ` · 应用：${application}` : ' · 全部应用'}
        </p>
      </div>
      <svg className="cockpitheroicon" viewBox="0 0 92 72" role="img" aria-label="经营趋势">
        <path d="M10 57 31 36l14 12 29-31" />
        <path d="M61 17h13v13M10 65h70" />
      </svg>
    </header>
  );
}
