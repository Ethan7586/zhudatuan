import { Button, DataTable, type DataColumn } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import { formatDate } from '../../../shared/ui/Format';
import type { ProductViewModel } from '../viewmodel/ProductViewModel';
import { ReferralState } from './ReferralState';

type Row = ProductViewModel['rows'][number];
const baseColumns: readonly DataColumn<Row>[] = Object.freeze([
  { key: 'product', label: '商品', render: (row) => chineseReference('商品', row.productId) },
  { key: 'state', label: '状态', render: (row) => <ReferralState value={row.enabled ? 'active' : 'inactive'} /> },
  { key: 'rate', label: '返佣比例', render: (row) => `${(row.rateBasisPoints / 100).toFixed(2)}%` },
  { key: 'reward', label: '客户奖励比例', render: (row) => `${(row.rewardBasisPoints / 100).toFixed(2)}%` },
  { key: 'updated', label: '更新时间', render: (row) => formatDate(row.updatedAt) },
  { key: 'version', label: '版本', render: (row) => `第 ${row.version} 版` },
]);

export function ProductTable({ model }: Readonly<{ model: ProductViewModel }>) {
  const columns = model.canManage ? [...baseColumns, { key: 'action', label: '操作', render: (row: Row) => <Button onPress={() => model.manage(row)}>编辑收益比例</Button> }] : baseColumns;
  return <DataTable caption="分销商品" columns={columns} rows={model.rows} rowKey={(row) => row.id} />;
}
