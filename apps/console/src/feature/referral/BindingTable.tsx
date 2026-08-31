import { DataTable, type DataColumn } from '../../shared/ui/DataTable';
import { formatDate } from '../../shared/ui/Format';
import type { ReferralBinding } from './ReferralSchema';

const columns: readonly DataColumn<ReferralBinding>[] = Object.freeze([
  { key: 'member', label: '客户会员', render: (row) => row.memberId },
  { key: 'promoter', label: '推广会员', render: (row) => row.promoterId },
  { key: 'source', label: '归因来源', render: (row) => row.source },
  { key: 'bound', label: '绑定时间', render: (row) => formatDate(row.boundAt) },
  { key: 'version', label: '版本', render: (row) => `v${row.version}` },
]);

export function BindingTable({ rows }: Readonly<{ rows: readonly ReferralBinding[] }>) {
  return <DataTable caption="分销关系" columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
