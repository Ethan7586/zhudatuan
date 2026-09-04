import { Button, DataTable, type DataColumn } from '@shop/design';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { formatDate } from '../../../../shared/ui/Format';
import type { Directory } from '../model/Directory';
import type { DirectoryViewModel } from '../viewmodel/DirectoryViewModel';

export function DirectoryTable({ rows, model }: Readonly<{ rows: readonly Directory[]; model: DirectoryViewModel }>) {
  const columns: readonly DataColumn<Directory>[] = [
    {
      key: 'provider',
      label: '目录来源',
      render: (row) => (
        <button type="button" className="directorylink" onClick={() => model.actions.select(row.id)}>
          {row.type === 'wecomcorp' ? '企业微信自建应用' : '企业微信第三方应用'}
        </button>
      ),
    },
    { key: 'organization', label: '目标组织', render: (row) => chineseReference('组织', row.organizationId) },
    { key: 'status', label: '连接状态', render: (row) => chineseDomainLabel(row.status) },
    {
      key: 'watermark',
      label: '最近成功水位',
      render: (row) => (
        <span>
          {formatDate(row.lastSuccessAt)}
          <small className="directorysub">源版本 {row.successfulVersion}</small>
        </span>
      ),
    },
    { key: 'updated', label: '配置更新时间', render: (row) => formatDate(row.updatedAt) },
    {
      key: 'action',
      label: '操作',
      render: (row) => (
        <div className="directoryactions">
          <Button onPress={() => model.actions.select(row.id)}>{model.selectedId === row.id ? '正在查看' : '查看历史'}</Button>
          {model.canSync && row.status === 'enabled' ? (
            <Button tone="primary" onPress={() => model.actions.start(row)}>
              启动同步
            </Button>
          ) : null}
        </div>
      ),
    },
  ];
  return <DataTable caption="通讯录连接列表" columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
