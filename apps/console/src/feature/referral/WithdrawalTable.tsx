import { chineseReference } from '@shop/presentation';
import { DataTable, type DataColumn } from '../../shared/ui/DataTable';
import { formatDate, formatMinor } from '../../shared/ui/Format';
import type { ReferralWithdrawal } from './ReferralSchema';
import { State } from './SettingsPanel';

const columns: readonly DataColumn<ReferralWithdrawal>[] = Object.freeze([
  { key: 'member', label: '会员', render: (row) => chineseReference('会员', row.memberId) },
  { key: 'state', label: '提现状态', render: (row) => <State value={row.status} /> },
  { key: 'amount', label: '提现金额', render: (row) => formatMinor(row.amountMinor, row.currency) },
  { key: 'account', label: '收款账户引用', render: (row) => chineseReference('收款账户', row.accountRef) },
  { key: 'requested', label: '申请时间', render: (row) => formatDate(row.requestedAt) },
  { key: 'completed', label: '完成时间', render: (row) => formatDate(row.completedAt) },
  { key: 'reason', label: '失败原因', render: (row) => row.failureReason ?? '—' },
  { key: 'version', label: '版本', render: (row) => `第 ${row.version} 版` },
]);

export function WithdrawalTable({ rows }: Readonly<{ rows: readonly ReferralWithdrawal[] }>) {
  return <DataTable caption="佣金提现" columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
