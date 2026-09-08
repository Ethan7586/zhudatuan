import { Button } from '../atom/Button';
import { Progress } from '../molecule/Progress';
import { Status } from '../token/Status';
import './Composite.css';

export interface TaskProgressProps {
  readonly label: string;
  readonly completed: number;
  readonly total: number;
  readonly status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  readonly receipt?: string;
  readonly onCancel?: () => void;
  readonly onRetry?: () => void;
}

export function TaskProgress({ label, completed, total, status, receipt, onCancel, onRetry }: Readonly<TaskProgressProps>) {
  const tone = status === 'completed' ? 'success' : status === 'failed' || status === 'cancelled' ? 'danger' : status === 'running' ? 'warning' : 'neutral';
  return <section className="shoptaskprogress" aria-live="polite"><header><strong>{label}</strong><Status tone={tone}>{taskLabel(status)}</Status></header><Progress value={Math.min(completed, total)} max={Math.max(total, 1)} label="任务进度" detail={`${completed}/${total}`} />{receipt === undefined ? null : <p>{receipt}</p>}<footer>{status === 'running' && onCancel ? <Button tone="quiet" onPress={onCancel}>取消任务</Button> : null}{status === 'failed' && onRetry ? <Button tone="primary" onPress={onRetry}>重试失败项</Button> : null}</footer></section>;
}

function taskLabel(status: TaskProgressProps['status']): string {
  return { queued: '等待执行', running: '执行中', completed: '已完成', failed: '失败', cancelled: '已取消' }[status];
}
