import { DataTable, type DataColumn } from '@shop/design';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { formatDate } from '../../../shared/ui/Format';
import type { BindingViewModel } from '../viewmodel/BindingViewModel';
import { ReferralState } from './ReferralState';

type Row = BindingViewModel['rows'][number];
const columns: readonly DataColumn<Row>[] = Object.freeze([
  { key: 'member', label: '客户会员', render: (row) => chineseReference('会员', row.memberId) },
  { key: 'promoter', label: '推广会员', render: (row) => chineseReference('推广会员', row.promoterId) },
  { key: 'source', label: '归因来源', render: (row) => chineseDomainLabel(row.source, '其他来源') },
  { key: 'bound', label: '绑定时间', render: (row) => formatDate(row.boundAt) },
  { key: 'expires', label: '归因到期', render: (row) => (row.expiresAt === null ? '永久有效' : formatDate(row.expiresAt)) },
  { key: 'state', label: '关系状态', render: (row) => <ReferralState value={row.status} /> },
  { key: 'version', label: '版本', render: (row) => `第 ${row.version} 版` },
]);

export function BindingTable({ model }: Readonly<{ model: BindingViewModel }>) {
  return <DataTable caption="分销关系" columns={columns} rows={model.rows} rowKey={(row) => row.id} />;
}
