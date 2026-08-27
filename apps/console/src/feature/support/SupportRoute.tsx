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
import { readCases, readMessages, supportCaseKey, supportMessageKey } from './SupportQuery';
import type { SupportCase, SupportMessage } from './SupportSchema';

const messageColumns: readonly DataColumn<SupportMessage>[] = [
  { key: 'author', label: '发送方', render: (row) => `${row.authorType}${row.author === null ? '' : ` · ${row.author}`}` },
  { key: 'body', label: '消息', render: (row) => row.body },
  { key: 'time', label: '发送时间', render: (row) => formatDate(row.createdAt) },
];

export function Component() {
  const { caseId } = useParams();
  return caseId === undefined ? <CaseList /> : <MessageList caseId={caseId} />;
}

function CaseList() {
  const context = useConsoleContext(); const [search, setSearch] = useSearchParams(); const cursor = search.get('cursor') ?? undefined;
  const query = useQuery({ queryKey: supportCaseKey(context, cursor), queryFn: ({ signal }) => readCases(context, cursor, signal) });
  const data = query.data; const error = safeQueryError(query.error);
  const supportPath = scopePath(context.scope, 'support');
  const columns: readonly DataColumn<SupportCase>[] = useMemo(() => [
    { key: 'subject', label: '工单', render: (row) => <Link to={`${supportPath}/${encodeURIComponent(row.id)}`}>{row.subject}</Link> },
    { key: 'priority', label: '优先级', render: (row) => row.priority },
    { key: 'state', label: '状态', render: (row) => row.state },
    { key: 'agent', label: '坐席', render: (row) => row.assigned_agent_id ?? '待分配' },
    { key: 'response', label: '响应期限', render: (row) => formatDate(row.response_due_at) },
    { key: 'updated', label: '更新时间', render: (row) => formatDate(row.updated_at) },
  ], [supportPath]);
  return <PagedResource title="客服中心" eyebrow="SMART WING SUPPORT" description="工单、分派和 SLA 均读取 support.cases.read，不在浏览器推导超时。"
    condition={condition(query, data?.items.length)} {...(error === undefined ? {} : { error })} rows={data?.items ?? []}
    columns={columns} rowKey={(row) => row.id} count={data?.count ?? 0}
    {...(data?.nextCursor === undefined ? {} : { nextCursor: data.nextCursor })}
    boundary={{ title: '客服写操作保持关闭', message: '回复、分派、关闭和重开未闭合 expectedVersion、Step-up 与回执时不执行。' }}
    retry={() => { void query.refetch(); }} next={(next) => setSearch(pageCursor(search, next))} />;
}

function MessageList({ caseId }: Readonly<{ caseId: string }>) {
  const context = useConsoleContext(); const [search, setSearch] = useSearchParams(); const cursor = search.get('cursor') ?? undefined;
  const query = useQuery({ queryKey: supportMessageKey(context, caseId, cursor), queryFn: ({ signal }) => readMessages(context, caseId, cursor, signal) });
  const data = query.data; const error = safeQueryError(query.error);
  return <PagedResource title="客服会话" eyebrow="SMART WING SUPPORT CASE" description={`工单 ${caseId} 的解密消息由 support.messages.read 返回。`}
    condition={condition(query, data?.items.length)} {...(error === undefined ? {} : { error })} rows={data?.items ?? []}
    columns={messageColumns} rowKey={(row) => row.id} count={data?.count ?? 0}
    {...(data?.nextCursor === undefined ? {} : { nextCursor: data.nextCursor })}
    boundary={{ title: '发送消息保持关闭', message: '附件签名上传、内容加密、幂等发送与最终回读未完整接入。' }}
    retry={() => { void query.refetch(); }} next={(next) => setSearch(pageCursor(search, next))} />;
}

function condition(query: Readonly<{ isPending: boolean; isFetching: boolean; error: Error | null; isStale: boolean; data?: unknown }>, length?: number) {
  return queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error,
    hasData: query.data !== undefined, empty: length === 0, stale: query.isStale });
}
