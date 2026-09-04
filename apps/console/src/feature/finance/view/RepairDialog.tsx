import { Button, Dialog, Status } from '@shop/design';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { PolicyViewModel } from '../viewmodel/PolicyViewModel';
import { ApprovalPanel } from './ApprovalPanel';
import { EntryEditor } from './EntryEditor';

export function RepairDialog({ model }: Readonly<{ model: PolicyViewModel }>) {
  const editor = model.repairEditor;
  if (!editor) return null;
  const title = editor.mode === 'create' ? '创建对账修复建议' : editor.mode === 'reverse' ? '回滚已批准修复' : '修复与审批详情';
  return (
    <Dialog open title={title} eyebrow="经办提交 · 独立复核 · 追加记账" description="预览不会改账；批准后只追加冲正与替换分录，绝不改写历史凭证。" onClose={model.actions.closeRepair} dismissable={!model.busy}>
      {editor.mode === 'create' ? <CreateRepair model={model} /> : editor.mode === 'reverse' ? <ReverseRepair model={model} /> : <ReviewRepair model={model} />}
    </Dialog>
  );
}

function CreateRepair({ model }: Readonly<{ model: PolicyViewModel }>) {
  const editor = model.repairEditor;
  if (editor?.mode !== 'create') return null;
  const preview = model.repairPreview;
  return <form className="governanceform" onSubmit={(event) => { event.preventDefault(); if (preview) model.actions.submitRepair(); else model.actions.previewRepair(); }}>
    <section className="governancesafety"><strong>先核验原账单和来源凭证</strong><p>服务端会校验账单哈希、并发版本、来源凭证及借贷平衡；提交只创建审批，不写账。</p></section>
    <div className="governancefields">
      <label>账单业务编号<input value={editor.draft.statementId} onChange={(event) => model.actions.repairField('statementId', event.target.value)} placeholder="statement:…" required /></label>
      <label>来源凭证编号<input value={editor.draft.sourceJournalId} onChange={(event) => model.actions.repairField('sourceJournalId', event.target.value)} placeholder="journal:…" required /></label>
      <label className="governancewide">账单 SHA-256 校验值<input value={editor.draft.sourceHash} minLength={64} maxLength={64} spellCheck={false} onChange={(event) => model.actions.repairField('sourceHash', event.target.value.trim().toLowerCase())} placeholder="64 位小写校验值" required /></label>
      <label>账单版本<input type="number" min={1} step={1} value={editor.draft.expectedVersion} onChange={(event) => model.actions.repairField('expectedVersion', Number(event.target.value))} required /></label>
      <label>修复原因<textarea value={editor.draft.reason} minLength={2} maxLength={1000} rows={3} onChange={(event) => model.actions.repairField('reason', event.target.value)} placeholder="说明差异、证据与建议处理方式" required /></label>
    </div>
    <EntryEditor entries={editor.draft.entries} disabled={model.busy} onChange={model.actions.repairEntry} onAdd={model.actions.addRepairEntry} onRemove={model.actions.removeRepairEntry} />
    {preview ? <section className="governancepreview" aria-label="修复服务端预览"><header><div><span>服务端修复预览</span><strong>{preview.repair.differences.length.toLocaleString('zh-CN')} 项差异</strong></div><Status tone={preview.balanced ? 'success' : 'danger'}>{preview.balanced ? '借贷平衡' : '校验失败'}</Status></header><p>有效至 {formatDate(preview.expiresAt)}；此时尚未写账、尚未发起审批。</p>{preview.repair.differences.length ? <ul>{preview.repair.differences.map((difference) => <li key={difference.id}><strong>{chineseDomainLabel(difference.kind)}</strong><span>{formatMinor(difference.deltaMinor, difference.currency)}</span><small>预期 {formatMinor(difference.expectedMinor, difference.currency)} · 实际 {formatMinor(difference.actualMinor, difference.currency)}</small></li>)}</ul> : <p>未返回差异明细，提交前请确认账单与来源凭证。</p>}<details><summary>技术核验信息</summary><code>{preview.previewHash}</code></details></section> : null}
    {preview ? <><label>一次性操作凭证<input type="password" value={editor.proof} autoComplete="off" spellCheck={false} onChange={(event) => model.actions.repairProof(event.target.value)} placeholder="粘贴与本次预览绑定的凭证" required /></label><label className="governanceconfirm"><input type="checkbox" checked={editor.confirmed} onChange={(event) => model.actions.repairConfirmed(event.target.checked)} />我已核对来源账单、差异、版本与平衡分录，并确认仅提交复核。</label></> : null}
    <Messages model={model} />
    <footer><Button onPress={model.actions.closeRepair} isDisabled={model.busy}>取消</Button>{preview ? <Button type="submit" tone="primary" isDisabled={model.busy || model.repairValidation !== undefined}>{model.busy ? '正在提交并回读…' : '提交复核'}</Button> : <Button type="submit" tone="primary" isDisabled={model.busy || Boolean(model.repairValidation && model.repairValidation !== '请先生成服务端修复预览。')}>{model.busy ? '正在核验…' : '生成修复预览'}</Button>}</footer>
  </form>;
}

function ReviewRepair({ model }: Readonly<{ model: PolicyViewModel }>) {
  const editor = model.repairEditor;
  if (editor?.mode !== 'review') return null;
  const repair = editor.repair;
  return <div className="governanceform"><section className="governancedetail"><header><div><strong>{chineseReference('修复建议', repair.id)}</strong><span>版本 v{repair.version}</span></div><Status tone={repair.status === 'approved' ? 'success' : repair.status === 'rejected' || repair.status === 'reversed' ? 'danger' : 'warning'}>{chineseDomainLabel(repair.status)}</Status></header><dl><div><dt>账单</dt><dd>{chineseReference('账单', repair.statementId)}</dd></div><div><dt>修复原因</dt><dd>{repair.reason}</dd></div><div><dt>经办人</dt><dd>{chineseReference('成员', repair.makerId)}</dd></div><div><dt>复核人</dt><dd>{repair.checkerId ? chineseReference('成员', repair.checkerId) : '尚未复核'}</dd></div><div><dt>冲正凭证</dt><dd>{repair.sourceReversalJournalId ? chineseReference('凭证', repair.sourceReversalJournalId) : '尚未生成'}</dd></div><div><dt>替换凭证</dt><dd>{repair.replacementJournalId ? chineseReference('凭证', repair.replacementJournalId) : '尚未生成'}</dd></div></dl><details><summary>技术核验信息</summary><code>{repair.sourceHash}</code><code>{repair.previewHash}</code></details></section><ApprovalPanel model={model} /><Messages model={model} /><footer><Button onPress={model.actions.closeRepair} isDisabled={model.busy}>关闭</Button></footer></div>;
}

function ReverseRepair({ model }: Readonly<{ model: PolicyViewModel }>) {
  const editor = model.repairEditor;
  if (editor?.mode !== 'reverse') return null;
  return <form className="governanceform" onSubmit={(event) => { event.preventDefault(); model.actions.submitReverse(); }}><section className="governancesafety"><strong>回滚通过追加凭证完成</strong><p>不会删除或改写原冲正、替换分录；服务端会生成新的回滚凭证并保留完整审计链。</p></section><section className="governancedetail"><strong>{chineseReference('修复建议', editor.repair.id)}</strong><span>当前版本 v{editor.repair.version}</span></section><label>回滚原因<textarea value={editor.reason} minLength={2} maxLength={1000} rows={3} onChange={(event) => model.actions.repairReason(event.target.value)} placeholder="说明回滚依据和后续处理计划" required /></label><label>一次性操作凭证<input type="password" value={editor.proof} autoComplete="off" spellCheck={false} onChange={(event) => model.actions.repairProof(event.target.value)} required /></label><label className="governanceconfirm"><input type="checkbox" checked={editor.confirmed} onChange={(event) => model.actions.repairConfirmed(event.target.checked)} />我确认以追加回滚凭证处理，历史分录保持不可变。</label><Messages model={model} /><footer><Button onPress={model.actions.closeRepair} isDisabled={model.busy}>取消</Button><Button type="submit" tone="danger" isDisabled={model.busy || model.repairValidation !== undefined}>{model.busy ? '正在执行并回读…' : '确认追加回滚凭证'}</Button></footer></form>;
}

function Messages({ model }: Readonly<{ model: PolicyViewModel }>) {
  return <>{model.assurance < 3 ? <section className="governancestepup"><p>此操作需要完成高强度身份验证。</p><Button tone="primary" onPress={model.actions.stepup}>立即验证</Button></section> : null}{model.repairError ? <p className="governanceerror" role="alert">{model.repairError}</p> : null}{model.repairValidation ? <p className="governancevalidation">{model.repairValidation}</p> : null}</>;
}
