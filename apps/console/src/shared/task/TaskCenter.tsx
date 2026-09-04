import { useEffect, useId, useRef, useState } from 'react';
import { TaskIndicator } from './TaskIndicator';

interface TaskCenterItem {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly state: string;
  readonly processed: number;
  readonly total: number;
  readonly category: 'import' | 'export' | 'sync' | 'issuance' | 'reconciliation' | 'job';
  readonly destination: string;
}

interface TaskCenterModel<T extends TaskCenterItem> {
  readonly items: readonly T[];
  readonly active: number;
  readonly failed: number;
  readonly loading: boolean;
  readonly denied: boolean;
  readonly error: string | undefined;
  readonly actions: Readonly<{ refresh: () => void; center: () => void; source: (task: T) => void }>;
}

export function TaskCenter<T extends TaskCenterItem>({ model }: Readonly<{ model: TaskCenterModel<T> }>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const popup = useId();
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', escape);
    };
  }, [open]);
  return <div className="headeractionwrap" ref={root}>
    <TaskIndicator active={model.active} failed={model.failed} loading={model.loading} open={open} controls={popup} onToggle={() => setOpen((value) => !value)} />
    {open ? <div id={popup} className="headerpopup globaltaskcenter" role="dialog" aria-label="全局任务中心">
      <header><div><strong>全局任务</strong><span>{summary(model.active, model.failed)}</span></div><button type="button" disabled={model.loading} onClick={model.actions.refresh}>{model.loading ? '读取中…' : '刷新'}</button></header>
      {model.denied ? <p>任务信息需要二次验证和查看权限，请前往任务中心继续。</p> : model.error ? <p role="alert">{model.error}</p> : model.items.length === 0 ? <p>暂无进行中或失败任务。</p> : <ul>{model.items.map((task) => <TaskItem key={`${task.type}:${task.id}`} task={task} open={() => { setOpen(false); model.actions.source(task); }} />)}</ul>}
      <button className="taskcenterlink" type="button" onClick={() => { setOpen(false); model.actions.center(); }}>查看全部任务</button>
    </div> : null}
  </div>;
}

function TaskItem<T extends TaskCenterItem>({ task, open }: Readonly<{ task: T; open: () => void }>) {
  const processed = task.total > 0 ? Math.min(task.processed, task.total) : undefined;
  const percent = processed === undefined ? undefined : Math.floor((processed / task.total) * 100);
  return <li><button type="button" onClick={open} aria-label={`${categoryText(task.category)}，${task.title}，${stateText(task.state)}，${task.destination}`}>
    <span className="taskcentercontent">
      <span className="taskcentertitle"><small data-category={task.category}>{categoryText(task.category)}</small><strong>{task.title}</strong></span>
      <span className="taskcentermeta"><small>{stateText(task.state)} · 已处理 {task.processed}{task.total > 0 ? ` / ${task.total}` : ''}{percent === undefined ? '' : ` · ${percent}%`}</small><small>{task.destination}</small></span>
      <progress max={task.total || 1} {...(processed === undefined ? {} : { value: processed })}>{task.processed}</progress>
    </span>
    <i data-state={task.state} aria-hidden="true" />
  </button></li>;
}

function summary(active: number, failed: number): string {
  if (active > 0 && failed > 0) return `${active} 个正在处理 · ${failed} 个需要关注`;
  if (active > 0) return `${active} 个正在处理`;
  if (failed > 0) return `${failed} 个需要关注`;
  return '没有进行中或失败任务';
}

function categoryText(category: TaskCenterItem['category']): string {
  return ({ import: '导入', export: '导出', sync: '同步', issuance: '发放', reconciliation: '对账', job: '后台作业' } as const)[category];
}

function stateText(state: string): string {
  return ({ queued: '等待执行', validating: '正在预检', ready: '等待确认', running: '正在执行', failed: '执行失败' } as Readonly<Record<string, string>>)[state] ?? '状态已更新';
}
