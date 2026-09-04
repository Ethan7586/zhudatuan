import { Button, DataTable, type DataColumn } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import { formatDate } from '../../../shared/ui/Format';
import type { ReviewViewModel } from '../viewmodel/ReviewViewModel';
import { ReferralState } from './ReferralState';

type Row = ReviewViewModel['rows'][number];
const baseColumns: readonly DataColumn<Row>[] = Object.freeze([
  { key: 'member', label: '会员', render: (row) => chineseReference('会员', row.memberId) },
  { key: 'state', label: '资格状态', render: (row) => <ReferralState value={row.status} /> },
  { key: 'applied', label: '申请时间', render: (row) => formatDate(row.appliedAt) },
  { key: 'approved', label: '通过时间', render: (row) => formatDate(row.approvedAt) },
  { key: 'disqualified', label: '取消时间', render: (row) => formatDate(row.disqualifiedAt) },
  { key: 'version', label: '版本', render: (row) => `第 ${row.version} 版` },
]);

export function ReviewTable({ model }: Readonly<{ model: ReviewViewModel }>) {
  const actionable = model.canApprove || model.canDisqualify;
  const columns = actionable
    ? [
        ...baseColumns,
        {
          key: 'actions',
          label: '操作',
          render: (row: Row) => (
            <div className="referralrowactions">
              {model.canApprove && row.status === 'applied' ? (
                <Button tone="primary" onPress={() => model.approve(row)}>
                  通过
                </Button>
              ) : null}
              {model.canDisqualify && row.status === 'active' ? <Button onPress={() => model.disqualify(row)}>取消资格</Button> : null}
              {row.status === 'disqualified' || (row.status === 'applied' && !model.canApprove) || (row.status === 'active' && !model.canDisqualify) ? <span>无需操作</span> : null}
            </div>
          ),
        },
      ]
    : baseColumns;
  return <DataTable caption="分销审核" columns={columns} rows={model.rows} rowKey={(row) => row.id} />;
}
