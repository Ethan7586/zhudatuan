import { DataTable, MetricGrid, Status, type DataColumn } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { ApprovalDecision, ApprovalInstance, ApprovalTask } from '../model/Approval';

export function ApprovalPanel({ instance, subjectLabel }: Readonly<{ instance: ApprovalInstance; subjectLabel: string }>) {
  const taskColumns: readonly DataColumn<ApprovalTask>[] = [
    { key: 'step', label: '步骤', render: (row) => `${row.sequence}. ${row.name}` },
    { key: 'assignee', label: '审批人', render: (row) => `${assigneeText(row.assigneeKind)} · ${row.assignee}` },
    { key: 'progress', label: '同意进度', render: (row) => `${row.approvalCount} / ${row.minimumApprovals}` },
    { key: 'state', label: '状态', render: (row) => <Status tone={taskTone(row.state)}>{statusText(row.state)}</Status> },
    { key: 'due', label: '处理期限', render: (row) => formatDate(row.dueAt) },
  ];
  const decisionColumns: readonly DataColumn<ApprovalDecision>[] = [
    { key: 'outcome', label: '决定', render: (row) => <Status tone={row.outcome === 'approved' ? 'success' : 'danger'}>{row.outcome === 'approved' ? '批准' : '拒绝'}</Status> },
    { key: 'reason', label: '原因', render: (row) => row.reason },
    { key: 'actor', label: '处理人', render: (row) => chineseReference('成员', row.actorId) },
    { key: 'time', label: '处理时间', render: (row) => formatDate(row.decidedAt) },
  ];
  return <div className="approvalstack" aria-label="审批实例证据">
    <MetricGrid items={[
      { label: '实例状态', value: statusText(instance.state), tone: instance.state === 'approved' ? 'success' : instance.state === 'rejected' || instance.state === 'expired' ? 'danger' : 'warning' },
      { label: '业务对象', value: chineseReference(subjectLabel, instance.subjectId) },
      { label: '审批进度', value: `${instance.currentStep} / ${instance.stepCount}` },
      { label: '申请金额', value: instance.amountMinor === null ? '不涉及金额' : formatMinor(instance.amountMinor, instance.currency ?? 'CNY') },
      { label: '申请人', value: chineseReference('成员', instance.requesterId) },
      { label: '发起时间', value: formatDate(instance.createdAt) },
      { label: '到期时间', value: formatDate(instance.expiresAt) },
      { label: '聚合版本', value: `v${instance.version}` },
    ]} />
    <p>业务动作：{instance.action}；审批规则版本：第 {instance.templateVersion} 版。</p>
    <DataTable caption="审批步骤与待办" rows={instance.tasks} columns={taskColumns} rowKey={(row) => row.id} />
    <DataTable caption="审批决定记录" rows={instance.decisions} columns={decisionColumns} rowKey={(row) => row.id} />
  </div>;
}

function statusText(value: string): string {
  return ({ draft: '草稿', enabled: '已启用', disabled: '已停用', pending: '待处理', approved: '已批准', rejected: '已拒绝', cancelled: '已取消', expired: '已过期', escalated: '已升级' } as Readonly<Record<string, string>>)[value] ?? value;
}

function assigneeText(value: ApprovalTask['assigneeKind']): string {
  return value === 'permission' ? '权限' : value === 'role' ? '角色' : '指定成员';
}

function taskTone(state: ApprovalTask['state']): 'success' | 'danger' | 'warning' {
  if (state === 'approved') return 'success';
  if (state === 'rejected' || state === 'expired' || state === 'cancelled') return 'danger';
  return 'warning';
}
