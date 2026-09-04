import { Button } from '@shop/design';
import type { ControlContentViewModel } from '../viewmodel/ControlViewModel';

type RuntimeContent = Extract<ControlContentViewModel, { kind: 'runtime' }>;

export function ControlHero({ title, content, refreshing, onRefresh }: Readonly<{ title: string; content: RuntimeContent | undefined; refreshing: boolean; onRefresh: () => void }>) {
  const healthy = content?.metrics.every((metric) => metric.healthy);
  const attention = content?.metrics.filter((metric) => !metric.healthy).length ?? 0;
  return (
    <header className="controlhero">
      <div>
        <p>主打团 · 平台运行控制</p>
        <h1>{title}</h1>
        <strong>{healthy === undefined ? '平台态势等待读模型返回，未知状态不会显示为正常。' : healthy ? '平台核心能力与服务目标运行稳定。' : `发现 ${attention} 类需要关注的运行状态。`}</strong>
        <span>统一查看能力分配、扩展健康、风险待办、服务目标与基础设施状态。</span>
      </div>
      <Button tone="primary" onPress={onRefresh} isDisabled={refreshing}>
        {refreshing ? '正在刷新态势…' : '刷新平台态势'}
      </Button>
    </header>
  );
}
