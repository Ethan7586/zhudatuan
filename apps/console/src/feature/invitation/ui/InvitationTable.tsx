import { Button } from '@shop/design';
import type { DataColumn } from '../../../shared/ui/DataTable';
import { invitationKind, invitationStatus, invitationTarget, invitationTime } from '../infrastructure/InvitationMapper';
import type { Invitation } from '../model/Invitation';

export function invitationColumns(canRevoke: boolean, onRevoke: (invitation: Invitation) => void): readonly DataColumn<Invitation>[] {
  return Object.freeze([
    { key: 'kind', label: '类型', render: (row) => invitationKind(row.kind) },
    { key: 'target', label: '使用位置', render: (row) => invitationTarget(row.target) },
    { key: 'recipient', label: '员工 / 接收人', render: (row) => row.recipient ?? '共享邀请' },
    { key: 'status', label: '状态', render: (row) => <span className={`invitationstatus invitationstatus${row.status}`}>{invitationStatus(row.status)}</span> },
    { key: 'usage', label: '使用次数', render: (row) => `${row.use_count} / ${row.max_uses}` },
    { key: 'expires', label: '到期时间', render: (row) => invitationTime(row.expires_at) },
    { key: 'issuer', label: '发起人', render: (row) => row.issuer_membership_id },
    { key: 'created', label: '创建时间', render: (row) => invitationTime(row.created_at) },
    { key: 'version', label: '版本', render: (row) => `v${row.version}` },
    { key: 'action', label: '操作', render: (row) => row.status === 'active' && canRevoke ? <Button tone="danger" onPress={() => onRevoke(row)}>撤销</Button> : '—' },
  ]);
}
