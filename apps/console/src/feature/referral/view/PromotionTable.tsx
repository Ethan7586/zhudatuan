import { DataTable, type DataColumn } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { PromotionViewModel } from '../viewmodel/PromotionViewModel';
import { ReferralState } from './ReferralState';

type Row = PromotionViewModel['rows'][number];
const columns: readonly DataColumn<Row>[] = Object.freeze([
  { key: 'order', label: '订单', render: (row) => chineseReference('订单', row.orderId) },
  { key: 'promoter', label: '推广会员', render: (row) => chineseReference('推广会员', row.promoterId) },
  { key: 'state', label: '账务状态', render: (row) => <ReferralState value={row.status} /> },
  { key: 'amount', label: '佣金', render: (row) => formatMinor(row.amountMinor, row.currency) },
  { key: 'available', label: '可结算时间', render: (row) => formatDate(row.availableAt) },
  { key: 'version', label: '版本', render: (row) => `第 ${row.version} 版` },
]);

export function PromotionTable({ model }: Readonly<{ model: PromotionViewModel }>) {
  return <DataTable caption="推广详情" columns={columns} rows={model.rows} rowKey={(row) => row.id} />;
}
