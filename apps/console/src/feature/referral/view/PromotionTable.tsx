import { DataTable, type DataColumn } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { PromotionViewModel } from '../viewmodel/PromotionViewModel';
import { ReferralState } from './ReferralState';

type Row = PromotionViewModel['rows'][number];
const columns: readonly DataColumn<Row>[] = Object.freeze([
  { key: 'order', label: '订单来源', render: (row) => <>{chineseReference('订单', row.orderId)}<br />{chineseReference('订单行', row.orderLineId)}</> },
  { key: 'promoter', label: '推广会员', render: (row) => chineseReference('推广会员', row.promoterId) },
  { key: 'kind', label: '收益类型', render: (row) => (row.kind === 'commission' ? '直接推广佣金' : '客户奖励') },
  { key: 'state', label: '账务状态', render: (row) => <ReferralState value={row.status} /> },
  { key: 'amount', label: '收益', render: (row) => formatMinor(row.amountMinor, row.currency) },
  { key: 'reversed', label: '已冲正', render: (row) => formatMinor(row.reversedMinor, row.currency) },
  { key: 'attribution', label: '归因与规则', render: (row) => <>{chineseReference('绑定', row.attributionId)}<br />{chineseReference('规则', row.ruleId)} · 第 {row.ruleVersion} 版</> },
  { key: 'journal', label: '财务凭证', render: (row) => row.settlementJournalId === null ? '尚未入账' : chineseReference('账本凭证', row.settlementJournalId) },
  { key: 'available', label: '可结算时间', render: (row) => formatDate(row.availableAt) },
]);

export function PromotionTable({ model }: Readonly<{ model: PromotionViewModel }>) {
  return <DataTable caption="推广详情" columns={columns} rows={model.rows} rowKey={(row) => row.id} />;
}
