import { Badge, Button, Surface, type BadgeTone } from '@shop/design';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import type { ConsoleContext, ConsoleScope } from '../../entity/session/ConsoleSession';
import { safeQueryError } from '../../shared/api/QueryState';
import { formatDate } from '../../shared/ui/Format';
import type { Application } from '../application/ApplicationSchema';
import {
  canReadMallNodeTask,
  canRetryMallNodeTask,
  mallNodeTaskId,
  mallNodeTaskKey,
  readMallNodeTaskOrNull,
  retryMallNodeTask,
  type AutoNodeTaskReceipt,
} from '../application/MallCreateCommand';

export function PlatformTaskCenter({
  applications,
  applicationsError,
  applicationsPending,
  context,
  onRetryApplications,
  scope,
}: Readonly<{
  applications: readonly Application[];
  applicationsError: string | undefined;
  applicationsPending: boolean;
  context: ConsoleContext;
  onRetryApplications: () => void;
  scope: ConsoleScope | undefined;
}>) {
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState<string>();
  const [retryError, setRetryError] = useState<Readonly<{ task: string; message: string }>>();
  const readable = canReadMallNodeTask(context, scope);
  const retryable = canRetryMallNodeTask(context, scope);
  const targets = applications.flatMap((application) => application.mall_id === null || application.mall_id === undefined
    ? [] : [{ taskId: mallNodeTaskId(application.mall_id) }]);
  const queries = useQueries({ queries: targets.map(({ taskId }) => ({
    queryKey: mallNodeTaskKey(context, scope, taskId),
    queryFn: ({ signal }: { signal: AbortSignal }) => readMallNodeTaskOrNull(context, scope!, taskId, signal),
    enabled: readable,
    refetchInterval: ({ state }: { state: { data: AutoNodeTaskReceipt | null | undefined } }) =>
      state.data !== null && state.data !== undefined && taskInProgress(state.data) ? 1_500 : false,
  })) });
  const tasks = queries.flatMap((query) => query.data === undefined || query.data === null ? [] : [query.data])
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
  const readError = queries.find((query) => query.error !== null)?.error;
  const pending = applicationsPending || queries.some((query) => query.isPending);

  const retryReads = () => {
    if (applicationsError !== undefined) onRetryApplications();
    for (const query of queries) void query.refetch();
  };
  const retryTask = async (task: AutoNodeTaskReceipt) => {
    if (!retryable || scope === undefined || retrying !== undefined) return;
    setRetrying(task.task_id);
    setRetryError(undefined);
    try {
      const next = await retryMallNodeTask(context, scope, task.task_id);
      if (next.task_id !== task.task_id) throw new Error('NODE_TASK_RETRY_CHAIN_CHANGED');
      const queryKey = mallNodeTaskKey(context, scope, task.task_id);
      queryClient.setQueryData<AutoNodeTaskReceipt | null>(queryKey, next);
      void queryClient.invalidateQueries({ queryKey });
    } catch (cause) {
      setRetryError({
        task: task.task_id,
        message: safeQueryError(cause instanceof Error ? cause : new Error('NODE_TASK_RETRY_FAILED'))
          ?? '重试请求失败',
      });
    } finally {
      setRetrying(undefined);
    }
  };

  const error = applicationsError ?? safeQueryError(readError ?? null);
  return <Surface className="distributedplatformtasks" depth="low" padding="none" role="region"
    aria-labelledby="distributedplatformtaskstitle">
    <header className="distributedplatformtasksheader">
      <div><span>PRODUCTION TASKS</span><h2 id="distributedplatformtaskstitle">平台生产任务</h2>
        <p>每个商城都读取其持久化节点任务；状态、时间和产出不由页面推测。</p></div>
      <Badge tone="neutral">{tasks.length} 项</Badge>
    </header>
    {!readable
      ? <TaskState title="当前身份无任务读取权限" detail="平台与商城目录仍可查看；任务记录需要当前范围的平台任务读取能力。" />
      : pending && tasks.length === 0
        ? <TaskState title="正在读取任务记录" detail="正在根据真实商城标识恢复对应的持久任务。" />
        : error !== undefined && tasks.length === 0
          ? <TaskState title="任务记录读取失败" detail={error}
              action={<Button onPress={retryReads}>重新读取</Button>} danger />
          : tasks.length === 0
            ? <TaskState title="暂无平台生产任务" detail="当前商城尚未关联节点生产任务；创建下级平台后会在这里持续显示。" />
            : <>
                {error === undefined ? null : <TaskState title="部分任务读取失败" detail={error}
                  action={<Button onPress={retryReads}>重新读取</Button>} danger />}
                <div className="distributedplatformtasklist">
                  {tasks.map((task) => <PlatformTask
                    key={task.task_id}
                    task={task}
                    application={applicationForTask(applications, task)}
                    canRetry={retryable}
                    retrying={retrying === task.task_id}
                    retryError={retryError?.task === task.task_id ? retryError.message : undefined}
                    onRetry={() => { void retryTask(task); }}
                  />)}
                </div>
              </>}
  </Surface>;
}

function PlatformTask({ application, canRetry, onRetry, retryError, retrying, task }: Readonly<{
  application: Application | undefined;
  canRetry: boolean;
  onRetry: () => void;
  retryError: string | undefined;
  retrying: boolean;
  task: AutoNodeTaskReceipt;
}>) {
  const latest = task.events.at(-1);
  const mayRetry = task.status === 'FAILED_RETRYABLE' || task.status === 'WAITING_EXTERNAL';
  return <article className="distributedplatformtask" data-status={task.status.toLowerCase()}>
    <header>
      <div><span>{application?.name ?? task.platform.name ?? task.platform.mall_id ?? '未关联平台名称'}</span>
        <strong>{task.node_id}</strong></div>
      <Badge tone={taskTone(task.status)}>{taskStatus(task.status)}</Badge>
    </header>
    <dl>
      <div><dt>任务 ID</dt><dd>{task.task_id}</dd></div>
      <div><dt>商城 ID</dt><dd>{task.platform.mall_id ?? '控制器未返回'}</dd></div>
      <div><dt>当前阶段</dt><dd>{task.phase}</dd></div>
      <div><dt>真实更新时间</dt><dd>{formatDate(task.updated_at)}</dd></div>
    </dl>
    <div className="distributedplatformtaskprogress">
      <div role="progressbar" aria-label={`${task.node_id} 任务进度`} aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={task.progress}><i style={{ width: `${task.progress}%` }} /></div><b>{task.progress}%</b>
    </div>
    <p className="distributedplatformtaskevent">{latest === undefined
      ? '控制器未返回事件摘要'
      : <><span>{latest.message}</span><time dateTime={latest.occurred_at}>{formatDate(latest.occurred_at)}</time></>}</p>
    {task.waiting_external.length === 0 ? null
      : <ul className="distributedplatformtaskwaiting">{task.waiting_external.map((item) => <li key={item}>{item}</li>)}</ul>}
    {task.last_error === null ? null
      : <p className="distributedplatformtaskerror" role="alert"><strong>错误摘要</strong>{task.last_error.message}</p>}
    {task.status === 'SUCCEEDED' ? <TaskResult task={task} /> : null}
    {retryError === undefined ? null
      : <p className="distributedplatformtaskerror" role="alert"><strong>重试失败</strong>{retryError}</p>}
    <footer><span>{task.started_at === null ? '尚未开始执行' : `开始于 ${formatDate(task.started_at)}`}</span>
      {mayRetry ? <Button onPress={onRetry} isDisabled={!canRetry || retrying}>
        {!canRetry ? '无重试权限' : retrying ? '正在重试' : task.status === 'WAITING_EXTERNAL' ? '重新检查并继续' : '重试一次'}
      </Button> : null}</footer>
  </article>;
}

function TaskResult({ task }: Readonly<{ task: AutoNodeTaskReceipt }>) {
  const result = task.result;
  return <section className="distributedplatformtaskresult" aria-label="真实任务产出">
    <div><span>NodeManifest</span><code>{result?.manifest_id ?? '控制器未返回标识'}</code></div>
    <div><span>访问入口</span>{result === null || result.access_entries.length === 0
      ? <p>控制器未返回可访问入口</p>
      : <nav>{result.access_entries.map((entry) => <a key={`${entry.surface_ref}:${entry.url}`} href={entry.url}
          target="_blank" rel="noreferrer">{surfaceLabel(entry.surface_ref)} · {entry.url}</a>)}</nav>}</div>
  </section>;
}

function TaskState({ action, danger = false, detail, title }: Readonly<{
  action?: ReactNode;
  danger?: boolean;
  detail: string;
  title: string;
}>) {
  return <div className="distributedplatformtaskstate" role={danger ? 'alert' : 'status'}>
    <div><strong>{title}</strong><p>{detail}</p></div>{action}
  </div>;
}

function applicationForTask(applications: readonly Application[], task: AutoNodeTaskReceipt): Application | undefined {
  return applications.find((application) => application.id === task.platform.application_id
    || application.mall_id === task.platform.mall_id);
}

function taskInProgress(task: AutoNodeTaskReceipt): boolean {
  return task.status === 'QUEUED' || task.status === 'RUNNING';
}

function taskStatus(status: AutoNodeTaskReceipt['status']): string {
  return { QUEUED: '排队中', RUNNING: '执行中', WAITING_EXTERNAL: '等待外部资源',
    FAILED_RETRYABLE: '执行失败', SUCCEEDED: '已完成' }[status];
}

function taskTone(status: AutoNodeTaskReceipt['status']): BadgeTone {
  return { QUEUED: 'neutral', RUNNING: 'info', WAITING_EXTERNAL: 'warning',
    FAILED_RETRYABLE: 'danger', SUCCEEDED: 'success' }[status] as BadgeTone;
}

function surfaceLabel(surface: string): string {
  return { 'surface:storefront': 'H5', 'surface:console': '控制台', 'surface:identity': '身份入口',
    'surface:api': 'API' }[surface] ?? surface;
}
