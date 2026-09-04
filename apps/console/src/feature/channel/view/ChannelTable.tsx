import { Button, DataTable, type DataColumn } from '@shop/design';
import { chineseDomainLabel, chineseProviderLabel } from '@shop/presentation';
import { formatCount, formatDate } from '../../../shared/ui/Format';
import type { ChannelConnection, ChannelOperation, ChannelSync } from '../model/Channel';
import { canCancel, canReplay, connectionActions } from '../model/ChannelPolicy';
import type { ChannelViewModel } from '../viewmodel/ChannelViewModel';

export function ChannelTable({ model }: Readonly<{ model: ChannelViewModel }>) {
  if (model.view === 'connections') return <DataTable caption="渠道连接" rows={model.rows.filter(isConnection)} columns={connectionColumns(model)} rowKey={(row) => row.id} />;
  if (model.view === 'syncs') return <DataTable caption="同步批次" rows={model.rows.filter(isSync)} columns={syncColumns(model)} rowKey={(row) => row.id} />;
  return <DataTable caption="外部操作" rows={model.rows.filter(isOperation)} columns={operationColumns(model)} rowKey={(row) => row.id} />;
}

function connectionColumns(model: ChannelViewModel): readonly DataColumn<ChannelConnection>[] {
  return [
    {
      key: 'provider',
      label: '服务商',
      render: (row) => (
        <>
          <strong>{chineseProviderLabel(row.provider)}</strong>
          <small>{row.id}</small>
        </>
      ),
    },
    {
      key: 'state',
      label: '连接状态',
      render: (row) => (
        <span className="channelstate" data-state={row.state}>
          {chineseDomainLabel(row.state)}
        </span>
      ),
    },
    {
      key: 'health',
      label: '健康检查',
      render: (row) => (
        <>
          {row.health.state ? chineseDomainLabel(row.health.state) : '尚未检查'}
          <small>{row.health.latencyMs === null ? '' : `${row.health.latencyMs} ms`}</small>
        </>
      ),
    },
    {
      key: 'limits',
      label: '限流与熔断',
      render: (row) => (
        <>
          <span>
            并发 {row.limits.maxConcurrency} · {row.limits.requestsPerSecond}/秒
          </span>
          <small>
            重试 {row.limits.maxAttempts} · 阈值 {row.limits.failureThreshold}
          </small>
        </>
      ),
    },
    {
      key: 'secret',
      label: '安全配置',
      render: (row) => (
        <>
          <span>{row.hasSecret ? '密钥引用已配置' : '无远程密钥'}</span>
          <small>
            {row.region} · Contract {row.contractVersion}
          </small>
        </>
      ),
    },
    {
      key: 'version',
      label: '版本 / 更新',
      render: (row) => (
        <>
          v{row.version}
          <small>{formatDate(row.updatedAt)}</small>
        </>
      ),
    },
    { key: 'actions', label: '操作', render: (row) => <ConnectionActions row={row} model={model} /> },
  ] as const;
}

function ConnectionActions({ row, model }: Readonly<{ row: ChannelConnection; model: ChannelViewModel }>) {
  const allowed = connectionActions(row, model.permissions);
  return (
    <div className="channelrowactions">
      {allowed.update ? <Button onPress={() => model.actions.update(row)}>配置</Button> : null}
      {allowed.test ? <Button onPress={() => model.actions.test(row)}>真实测试</Button> : null}
      {allowed.enable ? (
        <Button tone="primary" onPress={() => model.actions.enable(row)}>
          启用
        </Button>
      ) : null}
      {allowed.sync ? <Button onPress={() => model.actions.startSync(row)}>同步</Button> : null}
      {allowed.disable ? (
        <Button tone="danger" onPress={() => model.actions.disable(row)}>
          停用
        </Button>
      ) : null}
    </div>
  );
}

function syncColumns(model: ChannelViewModel): readonly DataColumn<ChannelSync>[] {
  return [
    {
      key: 'kind',
      label: '任务',
      render: (row) => (
        <>
          <strong>{chineseDomainLabel(row.kind)}</strong>
          <small>{row.id}</small>
        </>
      ),
    },
    { key: 'connection', label: '连接', render: (row) => row.connection },
    {
      key: 'state',
      label: '状态',
      render: (row) => (
        <span className="channelstate" data-state={row.state}>
          {chineseDomainLabel(row.state)}
        </span>
      ),
    },
    {
      key: 'progress',
      label: '进度',
      render: (row) => (
        <>
          <span>
            拉取 {formatCount(row.pulled)} · 接受 {formatCount(row.accepted)}
          </span>
          <small>
            拒绝 {formatCount(row.rejected)} · 错误 {formatCount(row.errors.length)}
          </small>
        </>
      ),
    },
    {
      key: 'watermark',
      label: '水位',
      render: (row) => (
        <>
          {formatDate(row.watermark)}
          <small>{row.cursor ? `游标 ${row.cursor}` : '无续传游标'}</small>
        </>
      ),
    },
    {
      key: 'time',
      label: '执行时间',
      render: (row) => (
        <>
          {formatDate(row.completedAt ?? row.startedAt)}
          <small>v{row.version}</small>
        </>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (row) =>
        canCancel(row, model.permissions) ? (
          <Button tone="danger" onPress={() => model.actions.cancelSync(row)}>
            取消
          </Button>
        ) : null,
    },
  ] as const;
}

function operationColumns(model: ChannelViewModel): readonly DataColumn<ChannelOperation>[] {
  return [
    {
      key: 'provider',
      label: '服务商',
      render: (row) => (
        <>
          <strong>{chineseProviderLabel(row.provider)}</strong>
          <small>{row.kind}</small>
        </>
      ),
    },
    {
      key: 'reference',
      label: '业务引用',
      render: (row) => (
        <>
          <span>{row.internalReference}</span>
          <small>{row.externalReference ?? '无外部回执'}</small>
        </>
      ),
    },
    {
      key: 'state',
      label: '状态',
      render: (row) => (
        <span className="channelstate" data-state={row.state}>
          {chineseDomainLabel(row.state)}
        </span>
      ),
    },
    { key: 'time', label: '更新时间', render: (row) => formatDate(row.updatedAt) },
    { key: 'actions', label: '操作', render: (row) => (canReplay(row, model.permissions) ? <Button onPress={() => model.actions.replay(row)}>安全重放</Button> : null) },
  ] as const;
}

function isConnection(row: ChannelViewModel['rows'][number]): row is ChannelConnection {
  return row.type === 'connection';
}
function isSync(row: ChannelViewModel['rows'][number]): row is ChannelSync {
  return row.type === 'sync';
}
function isOperation(row: ChannelViewModel['rows'][number]): row is ChannelOperation {
  return row.type === 'operation';
}
