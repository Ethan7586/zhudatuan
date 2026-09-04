import { Button, DataTable, type DataColumn } from '@shop/design';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { formatDate } from '../../../../shared/ui/Format';
import type { Store } from '../model/Store';
import type { PartnerViewModel } from '../viewmodel/PartnerViewModel';

export function StoreTable({ rows, model }: Readonly<{ rows: readonly Store[]; model: PartnerViewModel }>) {
  const columns: readonly DataColumn<Store>[] = [
    {
      key: 'name',
      label: '门店',
      render: (row) => (
        <button className="partnerlink" type="button" onClick={() => model.actions.select({ kind: 'store', value: row })}>
          {row.name}
        </button>
      ),
    },
    { key: 'mall', label: '所属商城', render: (row) => (row.mallId ? chineseReference('商城', row.mallId) : '未绑定商城') },
    { key: 'region', label: '服务区域', render: (row) => row.regionCode },
    { key: 'radius', label: '服务半径', render: (row) => (row.serviceRadiusMeters === null ? '未限制' : `${row.serviceRadiusMeters.toLocaleString('zh-CN')} 米`) },
    { key: 'address', label: '地址', render: (row) => (row.addressConfigured ? '已安全配置' : '未配置') },
    { key: 'status', label: '状态', render: (row) => chineseDomainLabel(row.status) },
    { key: 'updated', label: '更新时间', render: (row) => formatDate(row.updatedAt) },
    {
      key: 'action',
      label: '操作',
      render: (row) => (
        <div className="partneractions">
          <Button onPress={() => model.actions.select({ kind: 'store', value: row })}>查看</Button>
          {model.canManage ? (
            <Button tone="primary" onPress={() => model.actions.edit({ kind: 'store', value: row })}>
              编辑
            </Button>
          ) : null}
        </div>
      ),
    },
  ];
  return <DataTable caption="门店列表" columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
