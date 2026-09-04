export interface TaskIndicatorProps {
  readonly active: number;
  readonly failed: number;
  readonly loading: boolean;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly controls: string;
}

export function TaskIndicator({ active, failed, loading, open, onToggle, controls }: TaskIndicatorProps) {
  const label = loading ? '正在读取任务' : taskSummary(active, failed);
  return <button className="taskbutton" type="button" onClick={onToggle} aria-label={`全局任务中心，${label}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={controls}>
    <span aria-hidden="true" data-tone={failed > 0 ? 'danger' : active > 0 ? 'active' : 'idle'} />
    <b>任务</b>
    {active + failed > 0 ? <em>{Math.min(active + failed, 99)}</em> : null}
  </button>;
}

function taskSummary(active: number, failed: number): string {
  if (active > 0 && failed > 0) return `${active} 个进行中，${failed} 个失败`;
  if (failed > 0) return `${failed} 个任务失败`;
  if (active > 0) return `${active} 个任务进行中`;
  return '暂无进行中或失败任务';
}
