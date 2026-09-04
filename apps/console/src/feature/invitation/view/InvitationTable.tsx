import { Button } from '@shop/design';
import type { DataColumn } from '@shop/design';
import type { InvitationViewModel } from '../viewmodel/InvitationViewModel';
import { invitationKind, invitationStatus, invitationTarget, invitationTime } from '../viewmodel/InvitationText';

type Row = NonNullable<InvitationViewModel['page']>['items'][number];
export function invitationColumns(canRevoke: boolean, onRevoke: (invitation: Row) => void): readonly DataColumn<Row>[] {
  return Object.freeze([
    { key: 'kind', label: '类型', render: (row) => invitationKind(row.kind) },
    { key: 'target', label: '使用位置', render: (row) => invitationTarget(row.target) },
    {
      key: 'recipient',
      label: '员工 / 接收人',
      render: (row) => <Account name={row.recipientDisplayName} employee={row.recipientEmployeeNo} mobile={row.recipientMobileMasked} fallback={row.kind === 'campaign' ? '共享邀请' : '待注册员工'} />,
    },
    { key: 'status', label: '状态', render: (row) => <span className={`invitationstatus invitationstatus${row.status}`}>{invitationStatus(row.status)}</span> },
    { key: 'usage', label: '使用次数', render: (row) => `${row.useCount} / ${row.maxUses}` },
    { key: 'expires', label: '到期时间', render: (row) => invitationTime(row.expiresAt) },
    { key: 'issuer', label: '发起人', render: (row) => <Account name={row.issuerDisplayName} employee={row.issuerEmployeeNo} mobile={row.issuerMobileMasked} fallback="账号资料不可用" /> },
    { key: 'created', label: '创建时间', render: (row) => invitationTime(row.createdAt) },
    { key: 'version', label: '版本', render: (row) => `第 ${row.version} 版` },
    {
      key: 'action',
      label: '操作',
      render: (row) =>
        row.status === 'active' && canRevoke ? (
          <Button tone="danger" onPress={() => onRevoke(row)}>
            撤销
          </Button>
        ) : (
          '—'
        ),
    },
  ]);
}

function Account({ name, employee, mobile, fallback }: Readonly<{ name: string | null; employee: string | null; mobile: string | null; fallback: string }>) {
  const detail = employee ? `员工号 ${employee}` : mobile && mobile !== '***' ? `手机 ${mobile}` : undefined;
  return (
    <span className="invitationaccount">
      <strong>{name ?? fallback}</strong>
      {detail === undefined ? null : <small>{detail}</small>}
    </span>
  );
}
