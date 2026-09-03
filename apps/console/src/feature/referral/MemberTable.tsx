import { Button } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import { DataTable, type DataColumn } from '@shop/design';
import { formatDate } from '../../shared/ui/Format';
import type { ReferralAction, ReferralMember } from './ReferralSchema';
import { State } from './SettingsPanel';

export function MemberTable({ rows, canDecide, onDecide }: Readonly<{ rows: readonly ReferralMember[]; canDecide: boolean; onDecide: (action: ReferralAction) => void }>) {
  const columns: readonly DataColumn<ReferralMember>[] = [
    { key: 'member', label: '会员', render: (row) => chineseReference('会员', row.memberId) },
    { key: 'state', label: '资格状态', render: (row) => <State value={row.status} /> },
    { key: 'applied', label: '申请时间', render: (row) => formatDate(row.appliedAt) },
    { key: 'approved', label: '通过时间', render: (row) => formatDate(row.approvedAt) },
    { key: 'version', label: '版本', render: (row) => `第 ${row.version} 版` },
    {
      key: 'actions',
      label: '操作',
      render: (row) => (
        <div className="referralrowactions">
          <Button onPress={() => onDecide({ kind: 'approve', id: row.id, version: row.version, label: `通过${chineseReference('会员', row.memberId)}` })} isDisabled={!canDecide || row.status !== 'applied'}>
            通过
          </Button>
          <Button onPress={() => onDecide({ kind: 'disqualify', id: row.id, version: row.version, label: `取消${chineseReference('会员', row.memberId)}资格` })} isDisabled={!canDecide || row.status !== 'active'}>
            取消资格
          </Button>
        </div>
      ),
    },
  ];
  return <DataTable caption="分销审核" columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
