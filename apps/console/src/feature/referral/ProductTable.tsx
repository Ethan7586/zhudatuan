import { Button } from '@shop/design';
import { DataTable, type DataColumn } from '../../shared/ui/DataTable';
import { formatDate } from '../../shared/ui/Format';
import type { ReferralAction, ReferralProduct } from './ReferralSchema';
import { State } from './SettingsPanel';

export function ProductTable({ rows, canManage, onManage }: Readonly<{ rows: readonly ReferralProduct[]; canManage: boolean; onManage: (action: ReferralAction) => void }>) {
  const columns: readonly DataColumn<ReferralProduct>[] = [
    { key: 'product', label: '商品', render: (row) => row.productId },
    { key: 'state', label: '状态', render: (row) => <State value={row.enabled ? 'active' : 'inactive'} /> },
    { key: 'rate', label: '返佣比例', render: (row) => `${(row.rateBasisPoints / 100).toFixed(2)}%` },
    { key: 'updated', label: '更新时间', render: (row) => formatDate(row.updatedAt) },
    { key: 'version', label: '版本', render: (row) => `v${row.version}` },
    {
      key: 'action',
      label: '操作',
      render: (row) => (
        <Button onPress={() => onManage({ kind: 'product', id: row.productId, version: row.version, label: `编辑商品 ${row.productId}`, product: row })} isDisabled={!canManage}>
          编辑比例
        </Button>
      ),
    },
  ];
  return <DataTable caption="分销商品" columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
