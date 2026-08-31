import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import type { DataColumn } from '../../shared/ui/DataTable';
import { formatDate } from '../../shared/ui/Format';
import { PagedResource } from '../../shared/ui/PagedResource';
import { pageCursor } from '../../shared/url/PageCursor';
import { scopePath } from '../../shared/url/ScopePath';
import { readCases, readHistory, readMessages, readSupportAdmin, supportAdminKey, supportCaseKey, supportHistoryKey, supportMessageKey, type SupportAdminRow, type SupportView } from './SupportQuery';
import type { SupportCase, SupportHistory, SupportMessage } from './SupportSchema';

const messageColumns: readonly DataColumn<SupportMessage>[] = [
  { key: 'author', label: '发送方', render: (row) => `${row.authorType}${row.author === null ? '' : ` · ${row.author}`}` },
  { key: 'body', label: '消息', render: (row) => row.body },
  { key: 'time', label: '发送时间', render: (row) => formatDate(row.createdAt) },
];
const historyColumns: readonly DataColumn<SupportHistory>[] = [
  { key: 'sequence', label: '序号', render: (row) => row.sequence },
  { key: 'kind', label: '事件', render: (row) => row.kind },
  { key: 'actor', label: '操作人', render: (row) => row.actor_id },
  { key: 'time', label: '发生时间', render: (row) => formatDate(row.occurred_at) },
];
const adminColumns: readonly DataColumn<SupportAdminRow>[] = [
  { key: 'primary', label: '名称 / 对象', render: (row) => row.primary },
  { key: 'secondary', label: '配置', render: (row) => row.secondary },
  { key: 'metric', label: '指标', render: (row) => row.metric },
  { key: 'state', label: '状态', render: (row) => row.state },
  { key: 'version', label: '版本', render: (row) => row.version ?? '—' },
  { key: 'updated', label: '更新时间', render: (row) => (row.updated === null ? '—' : formatDate(row.updated)) },
];

export function Component() {
  const { caseId } = useParams();
  return caseId === undefined ? <CaseList /> : <MessageList caseId={caseId} />;
}

function CaseList() {
  const context = useConsoleContext();
  const [search, setSearch] = useSearchParams();
  const cursor = search.get('cursor') ?? undefined;
  const view = supportView(search.get('view'));
  const cases = useQuery({ queryKey: supportCaseKey(context, cursor), queryFn: ({ signal }) => readCases(context, cursor, signal), enabled: view === 'cases' });
  const admin = useQuery({ queryKey: supportAdminKey(context, view, cursor), queryFn: ({ signal }) => readSupportAdmin(context, view === 'cases' ? 'rules' : view, cursor, signal), enabled: view !== 'cases' });
  const query = view === 'cases' ? cases : admin;
  const error = safeQueryError(query.error);
  const supportPath = scopePath(context.scope, 'support');
  const columns: readonly DataColumn<SupportCase>[] = useMemo(
    () => [
      { key: 'subject', label: '工单', render: (row) => <Link to={`${supportPath}/${encodeURIComponent(row.id)}`}>{row.subject}</Link> },
      { key: 'priority', label: '优先级', render: (row) => row.priority },
      { key: 'state', label: '状态', render: (row) => row.state },
      { key: 'agent', label: '坐席', render: (row) => row.assigned_agent_id ?? '待分配' },
      { key: 'response', label: '响应期限', render: (row) => formatDate(row.response_due_at) },
      { key: 'updated', label: '更新时间', render: (row) => formatDate(row.updated_at) },
    ],
    [supportPath]
  );
  if (view !== 'cases')
    return (
      <PagedResource
        title="客服中心"
        eyebrow="SMART WING SUPPORT"
        description="分配规则、客服人员、客服账号与 SLA 均来自 Support 正式读模型。"
        condition={condition(admin, admin.data?.items.length)}
        {...(error === undefined ? {} : { error })}
        rows={admin.data?.items ?? []}
        columns={adminColumns}
        rowKey={(row) => row.id}
        count={admin.data?.count ?? 0}
        {...(admin.data?.nextCursor === undefined ? {} : { nextCursor: admin.data.nextCursor })}
        actions={<SupportViewSelect value={view} onChange={(next) => setSearch(viewSearch(search, next))} />}
        boundary={{ title: '客服配置写操作受保护', message: '修改规则、人员、账号或 SLA 需要版本、幂等键和高风险复核；本列表只展示权威配置。' }}
        retry={() => {
          void admin.refetch();
        }}
        next={(next) => setSearch(pageCursor(search, next))}
      />
    );
  const caseData = cases.data;
  return (
    <PagedResource
      title="客服中心"
      eyebrow="SMART WING SUPPORT"
      description="工单、分派和 SLA 均读取 support.cases.read，不在浏览器推导超时。"
      condition={condition(cases, caseData?.items.length)}
      {...(error === undefined ? {} : { error })}
      rows={caseData?.items ?? []}
      columns={columns}
      rowKey={(row) => row.id}
      count={caseData?.count ?? 0}
      {...(caseData?.nextCursor === undefined ? {} : { nextCursor: caseData.nextCursor })}
      actions={<SupportViewSelect value={view} onChange={(next) => setSearch(viewSearch(search, next))} />}
      boundary={{ title: '客服写操作保持关闭', message: '回复、分派、关闭和重开未闭合 expectedVersion、Step-up 与回执时不执行。' }}
      retry={() => {
        void cases.refetch();
      }}
      next={(next) => setSearch(pageCursor(search, next))}
    />
  );
}

function MessageList({ caseId }: Readonly<{ caseId: string }>) {
  const context = useConsoleContext();
  const [search, setSearch] = useSearchParams();
  const cursor = search.get('cursor') ?? undefined;
  const view = search.get('view') === 'history' ? 'history' : 'messages';
  const messages = useQuery({ queryKey: supportMessageKey(context, caseId, cursor), queryFn: ({ signal }) => readMessages(context, caseId, cursor, signal), enabled: view === 'messages' });
  const history = useQuery({ queryKey: supportHistoryKey(context, caseId, cursor), queryFn: ({ signal }) => readHistory(context, caseId, cursor, signal), enabled: view === 'history' });
  const actions = (
    <label>
      查看{' '}
      <select aria-label="会话视图" value={view} onChange={(event) => setSearch(viewSearch(search, event.target.value))}>
        <option value="messages">客服聊天</option>
        <option value="history">聊天记录</option>
      </select>
    </label>
  );
  if (view === 'history') {
    const error = safeQueryError(history.error);
    return (
      <PagedResource
        title="聊天记录"
        eyebrow="SMART WING SUPPORT HISTORY"
        description={`工单 ${caseId} 的不可变操作记录由 support.history.read 返回。`}
        condition={condition(history, history.data?.items.length)}
        {...(error === undefined ? {} : { error })}
        rows={history.data?.items ?? []}
        columns={historyColumns}
        rowKey={(row) => row.cursor_id}
        count={history.data?.count ?? 0}
        {...(history.data?.nextCursor === undefined ? {} : { nextCursor: history.data.nextCursor })}
        actions={actions}
        retry={() => {
          void history.refetch();
        }}
        next={(next) => setSearch(pageCursor(search, next))}
      />
    );
  }
  const error = safeQueryError(messages.error);
  return (
    <PagedResource
      title="客服会话"
      eyebrow="SMART WING SUPPORT CASE"
      description={`工单 ${caseId} 的解密消息由 support.messages.read 返回。`}
      condition={condition(messages, messages.data?.items.length)}
      {...(error === undefined ? {} : { error })}
      rows={messages.data?.items ?? []}
      columns={messageColumns}
      rowKey={(row) => row.id}
      count={messages.data?.count ?? 0}
      {...(messages.data?.nextCursor === undefined ? {} : { nextCursor: messages.data.nextCursor })}
      actions={actions}
      boundary={{ title: '发送消息受保护', message: '附件签名上传、内容加密和幂等发送必须通过正式消息 Operation。' }}
      retry={() => {
        void messages.refetch();
      }}
      next={(next) => setSearch(pageCursor(search, next))}
    />
  );
}

function SupportViewSelect({ value, onChange }: Readonly<{ value: SupportView; onChange: (view: SupportView) => void }>) {
  return (
    <label>
      查看{' '}
      <select aria-label="客服功能" value={value} onChange={(event) => onChange(supportView(event.target.value))}>
        <option value="cases">工单与聊天</option>
        <option value="rules">分配规则</option>
        <option value="agents">客服人员</option>
        <option value="accounts">客服账号</option>
        <option value="slas">SLA 配置</option>
      </select>
    </label>
  );
}

function supportView(value: string | null): SupportView {
  return value === 'rules' || value === 'agents' || value === 'accounts' || value === 'slas' ? value : 'cases';
}
function viewSearch(search: URLSearchParams, view: string): URLSearchParams {
  const next = new URLSearchParams(search);
  if (view === 'cases' || view === 'messages') next.delete('view');
  else next.set('view', view);
  next.delete('cursor');
  return next;
}

function condition(query: Readonly<{ isPending: boolean; isFetching: boolean; error: Error | null; isStale: boolean; data?: unknown }>, length?: number) {
  return queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: query.data !== undefined, empty: length === 0, stale: query.isStale });
}
