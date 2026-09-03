import { chineseDomainLabel, chineseReference, chineseSectionLabel, queryCondition, safeQueryError } from '@shop/presentation';
import { Button, ResourcePanel } from '@shop/design';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';

import { DataTable, MetricGrid, type DataColumn } from '@shop/design';
import { formatCount, formatDate } from '../../../shared/ui/Format';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { importKey, importKinds, readImport } from './ImportQuery';
import type { ImportError, ImportKind } from './ImportSchema';

const columns: readonly DataColumn<ImportError>[] = [
  { key: 'row', label: '行号', render: (row) => row.row_number },
  { key: 'reason', label: '错误原因', render: (row) => importIssue(row.reason_code) },
  { key: 'field', label: '字段', render: (row) => chineseDomainLabel(row.field, row.field ? '导入字段' : '—') },
  { key: 'detail', label: '说明', render: (row) => row.detail ?? '—' },
];

export function Component() {
  const params = useParams();
  const kind = importKinds.includes(params.kind as ImportKind) ? (params.kind as ImportKind) : null;
  const jobId = params.jobId ?? '';
  if (kind === null || jobId === '') throw new Response('IMPORT_ROUTE_INVALID', { status: 404 });
  return <ImportJobRoute kind={kind} jobId={jobId} />;
}

function ImportJobRoute({ kind, jobId }: Readonly<{ kind: ImportKind; jobId: string }>) {
  const context = useConsoleContext();
  const routeTitle = useRouteTitle('商品池');
  const query = useQuery({
    queryKey: importKey(context, kind, jobId),
    queryFn: ({ signal }) => readImport(context, kind, jobId, signal),
    refetchInterval: (current) => (['completed', 'failed', 'cancelled'].includes(current.state.data?.state ?? '') ? false : 3_000),
  });
  const data = query.data;
  const error = safeQueryError(query.error);
  const state = queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: false });
  return (
    <ResourcePanel
      title={routeTitle}
      eyebrow={chineseSectionLabel('商品导入')}
      description={`${chineseDomainLabel(kind, '商品数据')} · ${chineseReference('导入任务', jobId)}；进度、错误行和报告均由服务端任务返回。`}
      condition={state}
      {...(error === undefined ? {} : { error })}
      retry={() => {
        void query.refetch();
      }}
      actions={
        <Button
          onPress={() => {
            void query.refetch();
          }}
        >
          刷新进度
        </Button>
      }
    >
      {data === undefined ? (
        <span />
      ) : (
        <div className="featurestack">
          <MetricGrid
            items={[
              { label: '任务状态', value: chineseDomainLabel(data.state) },
              { label: '总行数', value: formatCount(data.total_count ?? 0) },
              { label: '成功', value: formatCount(data.success_count ?? 0), tone: 'success' },
              { label: '失败', value: formatCount(data.failure_count ?? 0), tone: (data.failure_count ?? 0) > 0 ? 'danger' : 'success' },
              { label: '更新时间', value: formatDate(data.updated_at) },
            ]}
          />
          {data.last_error === undefined || data.last_error === null ? null : (
            <section className="capabilitynote" aria-labelledby="importfailure">
              <h2 id="importfailure">任务错误</h2>
              <p>{importIssue(data.last_error)}</p>
            </section>
          )}
          <DataTable caption="导入错误行" columns={columns} rows={data.errors} rowKey={(row) => `${row.row_number}:${row.reason_code}:${row.field ?? ''}`} />
        </div>
      )}
    </ResourcePanel>
  );
}

function importIssue(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes('required')) return '缺少必填内容';
  if (normalized.includes('format') || normalized.includes('invalid')) return '内容格式不正确';
  if (normalized.includes('duplicate') || normalized.includes('conflict')) return '内容重复或已存在';
  return '导入内容需要人工检查';
}
