import { Button, DataTable, type DataColumn } from '@shop/design';
import { chineseDomainLabel } from '@shop/presentation';
import { formatDate } from '../../../../shared/ui/Format';
import type { DirectorySyncRun } from '../model/SyncRun';
import type { DirectoryViewModel } from '../viewmodel/DirectoryViewModel';

export function SyncRunTable({ rows, model }: Readonly<{ rows: readonly DirectorySyncRun[]; model: DirectoryViewModel }>) {
  const columns: readonly DataColumn<DirectorySyncRun>[] = [
    { key: 'mode', label: '模式', render: (row) => modeLabel(row.mode) },
    { key: 'state', label: '状态', render: (row) => chineseDomainLabel(row.state) },
    {
      key: 'progress',
      label: '处理进度',
      render: (row) => (
        <span>
          {progress(row)}
          <small className="directorysub">
            读取 {row.readCount} · 应用 {row.appliedCount} · 冲突 {row.conflictCount} · 忽略 {row.ignoredCount}
          </small>
        </span>
      ),
    },
    {
      key: 'watermark',
      label: '任务水位',
      render: (row) => (
        <span>
          {formatDate(row.watermark)}
          <small className="directorysub">{lag(row.watermark)}</small>
        </span>
      ),
    },
    {
      key: 'time',
      label: '开始 / 完成',
      render: (row) => (
        <span>
          {formatDate(row.startedAt)}
          <small className="directorysub">{formatDate(row.completedAt)}</small>
        </span>
      ),
    },
    {
      key: 'action',
      label: '操作',
      render: (row) =>
        model.canSync && model.selected ? (
          <div className="directoryactions">
            {row.state === 'queued' || row.state === 'running' ? (
              <Button tone="danger" onPress={() => model.actions.cancel(model.selected!, row)}>
                取消
              </Button>
            ) : null}
            {(row.state === 'failed' || row.state === 'cancelled') && (row.mode === 'full' || row.mode === 'incremental') ? (
              <Button tone="primary" onPress={() => model.actions.resume(model.selected!, row)}>
                恢复
              </Button>
            ) : null}
          </div>
        ) : null,
    },
  ];
  return <DataTable caption="同步运行历史" columns={columns} rows={rows} rowKey={(row) => row.id} />;
}

function modeLabel(value: DirectorySyncRun['mode']) {
  return { full: '全量', incremental: '增量', event: '事件', reconcile: '对账' }[value];
}
function progress(run: DirectorySyncRun): string {
  if (run.state === 'queued') return '等待执行';
  if (run.readCount === 0) return run.state === 'running' ? '正在读取' : '0 条';
  return `${Math.min(100, Math.round(((run.appliedCount + run.conflictCount + run.ignoredCount) / run.readCount) * 100))}%`;
}
function lag(value: string | null): string {
  if (!value) return '尚未形成处理水位';
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 1_000));
  if (seconds < 60) return `${seconds} 秒前推进`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)} 分钟前推进`;
  return `${Math.floor(seconds / 3_600)} 小时前推进`;
}
