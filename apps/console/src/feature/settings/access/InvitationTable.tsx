import { Button } from '@shop/design';
import type { DataColumn } from '../../../shared/ui/DataTable';
import type { Invitation } from './AccessSchema';

export function invitationColumns(canRevoke: boolean, onRevoke: (invitation: Invitation) => void): readonly DataColumn<Invitation>[] {
  return Object.freeze([
    { key: 'kind', label: '类型', render: (row) => kindLabel(row.kind) },
    { key: 'target', label: 'Target', render: (row) => row.target },
    { key: 'recipient', label: '接收人', render: (row) => row.recipient ?? '未绑定' },
    { key: 'status', label: '状态', render: (row) => statusLabel(row.status) },
    { key: 'usage', label: '已用/上限', render: (row) => `${row.use_count}/${row.max_uses}` },
    { key: 'effective', label: '生效时间', render: (row) => format(row.not_before) },
    { key: 'expires', label: '失效时间', render: (row) => format(row.expires_at) },
    { key: 'issuer', label: '签发者', render: (row) => row.issuer_membership_id },
    { key: 'issuerVersion', label: '签发者版本', render: (row) => row.issuer_access_version },
    { key: 'created', label: '创建时间', render: (row) => format(row.created_at) },
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

function kindLabel(value: Invitation['kind']): string {
  return value === 'signin' ? '登录邀请' : value === 'enrollment' ? '入驻邀请' : '活动邀请';
}
function statusLabel(value: Invitation['status']): string {
  return ({ draft: '草稿', active: '生效中', exhausted: '已用尽', revoked: '已撤销', expired: '已过期' } as const)[value];
}
function format(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}
