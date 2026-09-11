import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { safeQueryError } from '../../shared/api/QueryState';
import { OrderIcon } from './OrderIcon';
import {
  createOrderExport,
  ORDER_EXPORT_FIELDS,
  readOrderExport,
  taskStorageKey,
  type OrderExportDraft,
  type OrderExportField,
  type OrderExportFormat,
  type OrderExportTask,
} from './OrderExportQuery';
import './order-export.css';

type ExportRange = 'filter' | 'page' | 'selected';
const FIELD_GROUPS = Object.freeze([
  ['order', '订单基础'], ['member', '消费会员'], ['finance', '财务与支付'], ['product', '商品信息'],
  ['fulfillment', '履约信息'], ['aftersale', '售后信息'],
] as const);

export function OrderExportWorkspace({ context, mallName, pageIds, selectedIds, filter, onClose }: Readonly<{
  context: ConsoleContext;
  mallName: string;
  pageIds: readonly string[];
  selectedIds: readonly string[];
  filter: Readonly<Record<string, unknown>>;
  onClose: () => void;
}>) {
  const storageKey = taskStorageKey(context);
  const [range, setRange] = useState<ExportRange>(selectedIds.length > 0 ? 'selected' : 'filter');
  const [format, setFormat] = useState<OrderExportFormat>('xlsx');
  const [filename, setFilename] = useState(() => `订单明细_${dateStamp()}`);
  const [fields, setFields] = useState<ReadonlySet<OrderExportField>>(() => new Set(ORDER_EXPORT_FIELDS.map(([key]) => key)));
  const [taskIds, setTaskIds] = useState<readonly string[]>(() => loadTaskIds(storageKey));
  const [tasks, setTasks] = useState<readonly OrderExportTask[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();
  const hasPendingTask = tasks.length < taskIds.length || tasks.some((task) => task.state === 'queued' || task.state === 'running');

  const refreshTasks = useCallback(async (ids: readonly string[]) => {
    if (ids.length === 0) return;
    const settled = await Promise.allSettled(ids.map((id) => readOrderExport(context, id)));
    setTasks((current) => ids.flatMap((id, index) => {
      const result = settled[index];
      if (result?.status === 'fulfilled') return [result.value];
      const retained = current.find((task) => task.id === id);
      return retained === undefined ? [] : [retained];
    }));
  }, [context]);

  useEffect(() => { sessionStorage.setItem(storageKey, JSON.stringify(taskIds.slice(0, 20))); }, [storageKey, taskIds]);
  useEffect(() => {
    void refreshTasks(taskIds);
    if (taskIds.length === 0 || !hasPendingTask) return;
    const timer = window.setInterval(() => { void refreshTasks(taskIds); }, 3000);
    return () => window.clearInterval(timer);
  }, [hasPendingTask, refreshTasks, taskIds]);

  const rangeCount = range === 'selected' ? selectedIds.length : range === 'page' ? pageIds.length : undefined;
  const chosenFields = useMemo(() => ORDER_EXPORT_FIELDS.map(([key]) => key).filter((field) => fields.has(field)), [fields]);
  const draft = useMemo<OrderExportDraft>(() => ({
    format,
    filename: filename.trim() || `订单明细_${dateStamp()}`,
    fields: chosenFields,
    filter: {
      ...filter,
      ...(range === 'page' ? { orderIds: pageIds } : {}),
      ...(range === 'selected' ? { orderIds: selectedIds } : {}),
      range,
      mallName,
    },
  }), [chosenFields, filename, filter, format, mallName, pageIds, range, selectedIds]);

  const create = async (nextDraft: OrderExportDraft = draft) => {
    setCreating(true);
    setError(undefined);
    try {
      const task = await createOrderExport(context, nextDraft);
      setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)]);
      setTaskIds((current) => [task.id, ...current.filter((id) => id !== task.id)].slice(0, 20));
    } catch (cause) {
      setError(cause instanceof Error ? safeQueryError(cause) : 'REQUEST_FAILED');
    } finally {
      setCreating(false);
    }
  };

  const toggleField = (field: OrderExportField) => setFields((current) => {
    const next = new Set(current);
    if (next.has(field)) next.delete(field); else next.add(field);
    return next;
  });

  return (
    <section className="orderexportworkspace" aria-labelledby="orderexporttitle">
      <header className="orderexporthero">
        <button type="button" className="orderexportback" onClick={onClose}><OrderIcon name="arrowLeft" />返回订单列表</button>
        <div>
          <p>订单管理 / 导出订单</p>
          <h1 id="orderexporttitle">导出订单</h1>
          <span>按照真实订单筛选快照生成文件；任务在后台处理，完成后可直接下载。</span>
        </div>
      </header>

      <div className="orderexportgrid">
        <main className="orderexportform">
          <ExportSection number="1" title="选择导出范围" description="导出范围会固定为本次任务快照，不受后续列表切换影响。">
            <div className="orderexportranges">
              <RangeOption value="filter" checked={range === 'filter'} onChange={setRange} title="当前筛选结果" detail={`当前页 ${pageIds.length} 条，完整结果后台统计`} />
              <RangeOption value="page" checked={range === 'page'} onChange={setRange} title="当前页订单" detail={`${pageIds.length} 条`} />
              <RangeOption value="selected" checked={range === 'selected'} onChange={setRange} disabled={selectedIds.length === 0} title="已选订单" detail={selectedIds.length === 0 ? '列表中尚未勾选' : `${selectedIds.length} 条`} />
            </div>
          </ExportSection>

          <ExportSection number="2" title="选择导出字段" description={`已选择 ${chosenFields.length} / ${ORDER_EXPORT_FIELDS.length} 个字段`} action={(
            <div className="orderexportfieldactions">
              <button type="button" onClick={() => setFields(new Set(ORDER_EXPORT_FIELDS.map(([key]) => key)))}>全选</button>
              <button type="button" onClick={() => setFields(new Set())}>清空</button>
            </div>
          )}>
            <div className="orderexportfieldgroups">
              {FIELD_GROUPS.map(([group, label]) => (
                <fieldset key={group}>
                  <legend>{label}</legend>
                  {ORDER_EXPORT_FIELDS.filter(([, , owner]) => owner === group).map(([key, fieldLabel]) => (
                    <label key={key}><input type="checkbox" checked={fields.has(key)} onChange={() => toggleField(key)} />{fieldLabel}</label>
                  ))}
                </fieldset>
              ))}
            </div>
          </ExportSection>

          <ExportSection number="3" title="文件设置" description="Excel 适合直接查看和流转；CSV 适合系统处理。">
            <div className="orderexportfilesettings">
              <label><span>文件格式</span><select value={format} onChange={(event) => setFormat(event.target.value as OrderExportFormat)}><option value="xlsx">Excel 工作簿 (.xlsx)</option><option value="csv">CSV 数据文件 (.csv)</option></select></label>
              <label><span>文件名称</span><div className="orderexportfilename"><input value={filename} onChange={(event) => setFilename(event.target.value)} maxLength={80} /><b>.{format}</b></div></label>
            </div>
          </ExportSection>
        </main>

        <aside className="orderexportsummary" aria-label="导出摘要">
          <h2>导出摘要</h2>
          <dl>
            <div><dt>所属商城</dt><dd>{mallName}</dd></div>
            <div><dt>导出范围</dt><dd>{rangeLabel(range)}</dd></div>
            <div><dt>预计订单</dt><dd>{rangeCount === undefined ? '按真实结果生成' : `${rangeCount} 条`}</dd></div>
            <div><dt>字段数量</dt><dd>{chosenFields.length} 个</dd></div>
            <div><dt>文件格式</dt><dd>{format.toUpperCase()}</dd></div>
          </dl>
          <p><OrderIcon name="check" />导出任务使用创建时的筛选和字段快照。</p>
          {error === undefined ? null : <div className="orderexporterror" role="alert">{error}</div>}
          <button type="button" className="orderexportcreate" disabled={creating || chosenFields.length === 0 || rangeCount === 0} onClick={() => { void create(); }}>
            <OrderIcon name="download" />{creating ? '正在创建任务…' : '创建导出任务'}
          </button>
        </aside>
      </div>

      <section className="orderexporthistory" aria-labelledby="orderexporthistorytitle">
        <header><div><h2 id="orderexporthistorytitle">导出记录</h2><p>当前浏览器最近创建的任务，状态和下载地址来自服务端。</p></div><button type="button" onClick={() => { void refreshTasks(taskIds); }}><OrderIcon name="refresh" />刷新</button></header>
        {taskIds.length === 0 ? <div className="orderexportempty"><OrderIcon name="download" /><strong>还没有导出任务</strong><span>完成上方设置后创建第一份订单文件。</span></div> : (
          <div className="orderexporttablewrap"><table><thead><tr><th>创建时间</th><th>范围</th><th>格式</th><th>记录数</th><th>状态</th><th>操作</th></tr></thead><tbody>
            {tasks.map((task) => <ExportTaskRow key={task.id} task={task} onRetry={(retryDraft) => { void create(retryDraft); }} />)}
          </tbody></table></div>
        )}
      </section>
    </section>
  );
}

function ExportSection({ number, title, description, action, children }: Readonly<{ number: string; title: string; description: string; action?: ReactNode; children: ReactNode }>) {
  return <section className="orderexportsection"><header><b>{number}</b><div><h2>{title}</h2><p>{description}</p></div>{action}</header>{children}</section>;
}

function RangeOption({ value, checked, disabled, title, detail, onChange }: Readonly<{ value: ExportRange; checked: boolean; disabled?: boolean; title: string; detail: string; onChange: (value: ExportRange) => void }>) {
  return <label data-selected={checked || undefined} data-disabled={disabled || undefined}><input type="radio" name="export-range" checked={checked} disabled={disabled} onChange={() => onChange(value)} /><span><strong>{title}</strong><small>{detail}</small></span></label>;
}

function ExportTaskRow({ task, onRetry }: Readonly<{ task: OrderExportTask; onRetry: (draft: OrderExportDraft) => void }>) {
  const format = task.filter.format === 'csv' ? 'csv' : 'xlsx';
  const fields = Array.isArray(task.filter.fields) ? task.filter.fields.filter(isOrderExportField) : ORDER_EXPORT_FIELDS.map(([key]) => key);
  const filename = typeof task.filter.filename === 'string' ? task.filter.filename : `订单明细_${dateStamp()}`;
  return <tr><td>{formatTime(task.createdAt)}</td><td>{rangeLabel(task.filter.range === 'page' || task.filter.range === 'selected' ? task.filter.range : 'filter')}</td><td>{format.toUpperCase()}</td><td>{task.recordCount}</td><td><span className="orderexportstate" data-state={task.state}>{stateLabel(task.state)}</span>{task.errorCode === null ? null : <small>{task.errorCode}</small>}</td><td>{task.download === undefined ? <button type="button" disabled={task.state !== 'failed'} onClick={() => onRetry({ format, filename, fields, filter: task.filter })}>{task.state === 'failed' ? '重新创建' : '处理中'}</button> : <a href={task.download.url}>下载文件</a>}</td></tr>;
}

function isOrderExportField(value: unknown): value is OrderExportField { return typeof value === 'string' && ORDER_EXPORT_FIELDS.some(([key]) => key === value); }
function rangeLabel(range: ExportRange): string { return range === 'filter' ? '当前筛选结果' : range === 'page' ? '当前页订单' : '已选订单'; }
function stateLabel(state: OrderExportTask['state']): string { return ({ queued: '排队中', running: '生成中', completed: '已完成', failed: '失败', expired: '已过期' })[state]; }
function formatTime(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false }); }
function dateStamp(): string { return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('/', ''); }
function loadTaskIds(key: string): readonly string[] { try { const value = JSON.parse(sessionStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(0, 20) : []; } catch { return []; } }
