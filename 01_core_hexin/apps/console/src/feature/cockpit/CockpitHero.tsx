import { Button, WorkspaceHero } from '@shop/design';
import type { CockpitPeriod } from './CockpitQuery';

export interface CockpitHeroProps {
  readonly perspective?: Readonly<{ name: string; channel: string }>;
  readonly period: CockpitPeriod;
  readonly busy?: boolean;
  readonly onPeriodChange: (period: CockpitPeriod) => void;
  readonly onRefresh: () => void;
}

export function CockpitHero({ perspective, period, busy, onPeriodChange, onRefresh }: CockpitHeroProps) {
  return (
    <WorkspaceHero className="cockpithero" title={perspective === undefined ? '生意看板' : `${perspective.name}生意看板`}
      description={perspective === undefined ? '今天卖了多少、还有什么要处理，一眼看清。'
        : `${perspective.channel} · 只看当前供应商的销售、履约与结算结果。`}
      actions={<><label className="cockpitperiodfield">统计周期<select value={period}
        onChange={(event) => onPeriodChange(event.target.value as CockpitPeriod)}>
        <option value="realtime">今天</option><option value="yesterday">昨日</option>
        <option value="7days">近 7 日</option><option value="30days">近 30 日</option>
      </select></label><Button onPress={onRefresh}>{busy ? '正在刷新' : '刷新数据'}</Button></>} />
  );
}
