import { Button, Dialog, Status } from '@shop/design';
import { formatDate } from '../../../shared/ui/Format';
import type { PolicyViewModel } from '../viewmodel/PolicyViewModel';
import { EntryEditor } from './EntryEditor';

export function PolicyDialog({ model }: Readonly<{ model: PolicyViewModel }>) {
  const editor = model.policyEditor;
  if (!editor) return null;
  const preview = model.policyPreview;
  const title = editor.mode === 'create' ? '新建财务政策' : editor.mode === 'retire' ? '停用财务政策' : '修订财务政策';
  return (
    <Dialog open title={title} eyebrow="业务规则 · 影响预览 · 受控生效" description="先由服务端计算命中范围和样本，再用与本次变更绑定的一次性凭证执行。" onClose={model.actions.closePolicy} dismissable={!model.busy}>
      <form className="governanceform" onSubmit={(event) => { event.preventDefault(); if (preview) model.actions.submitPolicy(); else model.actions.previewPolicy(); }}>
        <section className="governancesafety"><strong>{editor.mode === 'retire' ? '停用不会删除历史政策' : '政策只影响生效期内的新财务事实'}</strong><p>历史账本保持不可变；服务端会再次校验作用域、版本、日期、币种和借贷平衡。</p></section>
        <div className="governancefields">
          <label>政策名称<input value={editor.draft.name} minLength={2} maxLength={200} disabled={editor.mode === 'retire'} onChange={(event) => model.actions.policyField('name', event.target.value)} placeholder="例如：商品订单收入确认" required /></label>
          <label>业务触发条件<input value={editor.draft.trigger} minLength={2} maxLength={200} disabled={editor.mode === 'retire'} onChange={(event) => model.actions.policyField('trigger', event.target.value)} placeholder="例如：订单支付成功" required /></label>
          <label>生效日期<input type="date" value={editor.draft.effectiveDate} disabled={editor.mode === 'retire'} onChange={(event) => model.actions.policyField('effectiveDate', event.target.value)} required /></label>
          <label>失效日期（可选）<input type="date" value={editor.draft.expiresDate} disabled={editor.mode === 'retire'} onChange={(event) => model.actions.policyField('expiresDate', event.target.value)} /></label>
          <label>影响样本开始<input type="date" value={editor.draft.sampleFrom} onChange={(event) => model.actions.policyField('sampleFrom', event.target.value)} required /></label>
          <label>影响样本结束<input type="date" value={editor.draft.sampleTo} onChange={(event) => model.actions.policyField('sampleTo', event.target.value)} required /></label>
        </div>
        <EntryEditor entries={editor.draft.entries} disabled={model.busy || editor.mode === 'retire'} onChange={model.actions.policyEntry} onAdd={model.actions.addPolicyEntry} onRemove={model.actions.removePolicyEntry} />
        {preview ? (
          <section className="governancepreview" aria-label="政策服务端预览">
            <header><div><span>服务端影响预览</span><strong>{preview.affectedCount.toLocaleString('zh-CN')} 条样本将命中</strong></div><Status tone={preview.balanced ? 'success' : 'danger'}>{preview.balanced ? '借贷平衡' : '校验失败'}</Status></header>
            <p>预览有效至 {formatDate(preview.expiresAt)}。任何字段变化都会使此预览失效并要求重新计算。</p>
            <ul>{preview.sampleEntries.map((entry, index) => <li key={`${entry.account}:${index}`}><strong>{entry.account}</strong><span>借 {entry.debitMinor.toLocaleString('zh-CN')} / 贷 {entry.creditMinor.toLocaleString('zh-CN')} 分</span><small>{entry.memo}</small></li>)}</ul>
            <details><summary>技术核验信息</summary><code>{preview.previewHash}</code></details>
          </section>
        ) : null}
        {preview ? <><label>一次性操作凭证<input type="password" value={editor.proof} autoComplete="off" spellCheck={false} onChange={(event) => model.actions.policyProof(event.target.value)} placeholder="粘贴与这次预览绑定的凭证" required /></label><label className="governanceconfirm"><input type="checkbox" checked={editor.confirmed} onChange={(event) => model.actions.policyConfirmed(event.target.checked)} />我已核对政策、样本影响、生效日期和复式分录。</label></> : null}
        {model.assurance < 3 ? <section className="governancestepup"><p>变更财务政策需要完成高强度身份验证。</p><Button tone="primary" onPress={model.actions.stepup}>立即验证</Button></section> : null}
        {model.policyError ? <p className="governanceerror" role="alert">{model.policyError}</p> : null}
        {model.policyValidation ? <p className="governancevalidation">{model.policyValidation}</p> : null}
        <footer><Button onPress={model.actions.closePolicy} isDisabled={model.busy}>取消</Button>{preview ? <Button type="submit" tone={editor.mode === 'retire' ? 'danger' : 'primary'} isDisabled={model.busy || model.policyValidation !== undefined}>{model.busy ? '正在执行并回读…' : editor.mode === 'retire' ? '确认停用' : '确认生效'}</Button> : <Button type="submit" tone="primary" isDisabled={model.busy || Boolean(model.policyValidation && model.policyValidation !== '请先生成服务端影响预览。')}>{model.busy ? '正在计算…' : '生成影响预览'}</Button>}</footer>
      </form>
    </Dialog>
  );
}
