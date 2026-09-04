import { Button, ResourcePanel, Status } from '@shop/design';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { PolicyViewModel } from '../viewmodel/PolicyViewModel';

export function ApprovalPanel({ model }: Readonly<{ model: PolicyViewModel }>) {
  const instance = model.approval.instance;
  const editor = model.repairEditor;
  if (editor?.mode !== 'review') return null;
  if (!editor.repair.approvalInstanceId) return <section className="governanceapprovalempty"><strong>尚未创建审批实例</strong><p>只有成功提交的修复建议才会进入经办、复核分离流程。</p></section>;
  return (
    <ResourcePanel
      headingLevel={2}
      eyebrow="独立 Approval 服务"
      title={instance ? chineseReference('审批实例', instance.id) : '正在读取审批证据'}
      description="审批决定先由 Approval 留痕并签发一次性证明，再由 Finance 消费证明落地修复。证明不会在页面展示。"
      condition={model.approval.condition}
      {...(model.approval.error ? { error: model.approval.error } : {})}
      retry={model.actions.retryApproval}
    >
      {instance ? <div className="approvalpanelbody">
        <div className="approvalpanelmetrics">
          <div><span>审批状态</span><Status tone={instance.state === 'approved' ? 'success' : instance.state === 'rejected' ? 'danger' : 'warning'}>{chineseDomainLabel(instance.state)}</Status></div>
          <div><span>审批进度</span><strong>{instance.currentStep} / {instance.stepCount}</strong></div>
          <div><span>涉及金额</span><strong>{instance.amountMinor === null ? '不适用' : formatMinor(instance.amountMinor, instance.currency ?? 'CNY')}</strong></div>
          <div><span>发起时间</span><strong>{formatDate(instance.createdAt)}</strong></div>
        </div>
        <ol className="approvaltimeline">
          <li><strong>经办人提交修复建议</strong><span>{chineseReference('成员', instance.requesterId)}</span></li>
          {instance.tasks.map((task) => <li key={task.id} data-state={task.state}><strong>{task.name}</strong><span>{chineseDomainLabel(task.state)} · 已同意 {task.approvalCount}/{task.minimumApprovals}</span></li>)}
          {instance.decisions.map((decision) => <li key={decision.id} data-state={decision.outcome}><strong>{decision.outcome === 'approved' ? '复核人批准' : '复核人拒绝'}</strong><span>{decision.reason} · {formatDate(decision.decidedAt)}</span></li>)}
        </ol>
        {model.approval.task ? <section className="approvaldecision"><label>复核意见<textarea value={editor.reason} minLength={2} maxLength={1000} rows={3} onChange={(event) => model.actions.repairReason(event.target.value)} placeholder="说明批准或驳回依据" required /></label><p>复核人与经办人必须不同；服务端会拒绝同人操作和失效版本。</p><div>{model.can.repairReject ? <Button tone="danger" onPress={() => model.actions.decideRepair('reject')} isDisabled={model.busy || model.repairValidation !== undefined}>驳回修复</Button> : null}{model.can.repairApprove ? <Button tone="primary" onPress={() => model.actions.decideRepair('approve')} isDisabled={model.busy || model.repairValidation !== undefined}>批准并追加修复分录</Button> : null}</div></section> : <p className="governancecomplete">当前没有待处理审批任务。已完成的决定与业务落地结果仍可追溯。</p>}
      </div> : null}
    </ResourcePanel>
  );
}
