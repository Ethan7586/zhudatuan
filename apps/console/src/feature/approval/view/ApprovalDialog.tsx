import { Button, Dialog } from '@shop/design';
import type { ApprovalSubjectKind, ApprovalTemplateDraft } from '../model/Approval';
import type { ApprovalViewModel } from '../viewmodel/ApprovalViewModel';

export function ApprovalDialog({ model }: Readonly<{ model: ApprovalViewModel }>) {
  const editor = model.editor;
  if (editor === undefined) return null;
  const templateEditor = editor.command === 'create' || editor.command === 'revise';
  const title = editor.command === 'create' ? '新建审批规则' : editor.command === 'revise' ? '修订审批规则' : editor.command === 'enable' ? '启用审批规则' : editor.command === 'disable' ? '停用审批规则' : editor.command === 'approve' ? '批准待办' : '拒绝待办';
  return <Dialog open title={title} eyebrow="版本校验 · 幂等提交 · 权威回读" onClose={model.actions.close} dismissable={!model.busy}>
    <form className="approvalform" onSubmit={(event) => { event.preventDefault(); model.actions.submit(); }}>
      {templateEditor ? <TemplateFields model={model} draft={editor.draft} codeLocked={editor.command === 'revise'} /> : <DecisionFields model={model} editor={editor} />}
      <p className="approvalsecurity">{model.assurance >= 3 ? '当前会话满足操作验证等级；服务端仍会检查权限、目标版本和业务不变量。' : '此操作需要完成二次验证。'}</p>
      {model.assurance < 3 ? <Button tone="primary" onPress={model.actions.stepup}>立即完成二次验证</Button> : null}
      {model.mutationError ? <p className="approvalerror" role="alert">{model.mutationError}</p> : null}
      {model.conflict ? <section className="approvalerror" role="alert" aria-label="审批并发冲突"><strong>{model.conflict.title}</strong><p>系统已完成权威回读，没有覆盖其他人的审批结果。</p><ul>{model.conflict.details.map((detail) => <li key={detail}>{detail}</li>)}</ul><Button onPress={model.actions.resolveConflict}>{model.conflict.next ? '应用最新基线并重新复核' : '关闭并重新选择目标'}</Button></section> : null}
      {model.validation ? <p className="approvalvalidation">{model.validation}</p> : null}
      <footer><Button onPress={model.actions.close} isDisabled={model.busy}>取消</Button><Button type="submit" tone={editor.command === 'disable' || editor.command === 'reject' ? 'danger' : 'primary'} isDisabled={model.busy || model.validation !== undefined}>{model.busy ? '正在提交…' : '确认提交'}</Button></footer>
    </form>
  </Dialog>;
}

function TemplateFields({ model, draft, codeLocked }: Readonly<{ model: ApprovalViewModel; draft: ApprovalTemplateDraft; codeLocked: boolean }>) {
  return <>
    <label>规则编码<input value={draft.code} disabled={codeLocked} minLength={3} maxLength={64} onChange={(event) => model.actions.field('code', event.target.value)} required /></label>
    <label>规则名称<input value={draft.name} minLength={2} maxLength={500} onChange={(event) => model.actions.field('name', event.target.value)} required /></label>
    <label>适用业务<select value={draft.subjectKind} onChange={(event) => model.actions.field('subjectKind', event.target.value as ApprovalSubjectKind)}>{model.subjects.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}</select></label>
    <section className="approvalbuilder" aria-label="审批步骤">
      <header><strong>审批步骤</strong><Button onPress={model.actions.addStep}>增加步骤</Button></header>
      {draft.steps.map((step, stepIndex) => <fieldset key={step.sequence}>
        <legend>第 {stepIndex + 1} 步</legend>
        <label>步骤名称<input value={step.name} minLength={2} maxLength={500} onChange={(event) => model.actions.step(stepIndex, 'name', event.target.value)} required /></label>
        <label>处理时限（小时）<input type="number" min={1} step={1} value={step.dueHours} onChange={(event) => model.actions.step(stepIndex, 'dueHours', Number(event.target.value))} /></label>
        {step.approvers.map((approver, approverIndex) => <div className="approvalapprover" key={`${step.sequence}:${approverIndex}`}>
          <label>审批人类型<select value={approver.kind} onChange={(event) => model.actions.approver(stepIndex, approverIndex, 'kind', event.target.value)}><option value="permission">按权限</option><option value="role">按角色</option><option value="membership">指定成员</option></select></label>
          <label>审批人条件<input value={approver.value} minLength={2} maxLength={500} onChange={(event) => model.actions.approver(stepIndex, approverIndex, 'value', event.target.value)} required /></label>
          <label>最少同意人数<input type="number" min={1} step={1} value={approver.minimumApprovals} onChange={(event) => model.actions.approver(stepIndex, approverIndex, 'minimumApprovals', Number(event.target.value))} /></label>
          {step.approvers.length > 1 ? <Button tone="danger" onPress={() => model.actions.removeApprover(stepIndex, approverIndex)}>移除此条件</Button> : null}
        </div>)}
        <div className="approvalactions"><Button onPress={() => model.actions.addApprover(stepIndex)}>增加审批人条件</Button>{draft.steps.length > 1 ? <Button tone="danger" onPress={() => model.actions.removeStep(stepIndex)}>移除此步骤</Button> : null}</div>
      </fieldset>)}
    </section>
    <section className="approvalbuilder" aria-label="超时升级">
      <header><strong>超时升级（可选）</strong><Button onPress={model.actions.addEscalation}>增加升级规则</Button></header>
      {draft.escalations.length === 0 ? <p>暂无升级规则；任务到期时仅保留原状态。</p> : null}
      {draft.escalations.map((escalation, index) => <fieldset key={index}>
        <legend>升级规则 {index + 1}</legend>
        <label>触发时限（小时）<input type="number" min={1} step={1} value={escalation.afterHours} onChange={(event) => model.actions.escalation(index, 'afterHours', Number(event.target.value))} /></label>
        <label>处理方式<select value={escalation.action} onChange={(event) => model.actions.escalation(index, 'action', event.target.value)}><option value="notify">提醒</option><option value="reassign">重新指派</option><option value="reject">自动拒绝</option></select></label>
        {escalation.action === 'reassign' ? <label>重新指派目标<input value={escalation.target ?? ''} minLength={2} maxLength={500} onChange={(event) => model.actions.escalation(index, 'target', event.target.value)} required /></label> : null}
        <Button tone="danger" onPress={() => model.actions.removeEscalation(index)}>移除此规则</Button>
      </fieldset>)}
    </section>
  </>;
}

function DecisionFields({ model, editor }: Readonly<{ model: ApprovalViewModel; editor: Exclude<NonNullable<ApprovalViewModel['editor']>, Readonly<{ command: 'create' | 'revise' }>> }>) {
  const target = editor.command === 'approve' || editor.command === 'reject' ? editor.task.name : editor.template.name;
  return <><section className="approvaltarget"><strong>{target}</strong><span>当前操作：{editor.command === 'enable' ? '启用规则' : editor.command === 'disable' ? '停用规则' : editor.command === 'approve' ? '批准待办' : '拒绝待办'}</span></section><label>审计原因<textarea value={editor.reason} minLength={2} maxLength={500} onChange={(event) => model.actions.reason(event.target.value)} required /></label></>;
}
