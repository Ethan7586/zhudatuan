import { DataTable, type DataColumn } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { WithdrawalViewModel } from '../viewmodel/WithdrawalViewModel';
import { ReferralState } from './ReferralState';

type Row = WithdrawalViewModel['rows'][number];
const columns: readonly DataColumn<Row>[] = Object.freeze([
  { key: 'member', label: '会员', render: (row) => chineseReference('会员', row.memberId) },
  { key: 'state', label: '提现状态', render: (row) => <ReferralState value={row.status} /> },
  { key: 'amount', label: '提现金额', render: (row) => formatMinor(row.amountMinor, row.currency) },
  { key: 'account', label: '收款账户引用', render: (row) => chineseReference('收款账户', row.accountRef) },
  { key: 'references', label: '审批与财务引用', render: (row) => <>{chineseReference('审批', row.approvalId)}<br />{row.providerReference === null ? '尚未付款入账' : chineseReference('付款凭证', row.providerReference)}</> },
  { key: 'requested', label: '申请时间', render: (row) => formatDate(row.requestedAt) },
  { key: 'completed', label: '完成时间', render: (row) => formatDate(row.completedAt) },
  { key: 'reason', label: '失败原因', render: (row) => row.failureReason ?? '—' },
  { key: 'version', label: '版本', render: (row) => `第 ${row.version} 版` },
]);

export function WithdrawalTable({ model }: Readonly<{ model: WithdrawalViewModel }>) {
  return <DataTable caption="佣金提现" columns={columns} rows={model.rows} rowKey={(row) => row.id} />;
}
