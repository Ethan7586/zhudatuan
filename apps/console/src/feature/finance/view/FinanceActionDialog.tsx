import { Button, Dialog } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import { financeActionAssurance, financeActionNeedsProof } from '../model/FinanceCommand';
import type { SectionViewModel } from '../viewmodel/SectionViewModel';

export function FinanceActionDialog({ model }: Readonly<{ model: SectionViewModel }>) {
  const editor = model.action;
  if (editor === undefined) return null;
  const { target, draft } = editor;
  const proofRequired = financeActionNeedsProof(target);
  const assuranceRequired = financeActionAssurance(target);
  return (
    <Dialog open title={target.label} eyebrow="核对 · 验证 · 执行 · 回读" description="服务端会校验权限、范围、版本、幂等键和复核凭证。" onClose={model.actions.cancel} dismissable={!editor.busy}>
      <form className="financeactionform" onSubmit={(event) => { event.preventDefault(); model.actions.submit(); }}>
        <section className="financeactiontarget" aria-label="操作目标">
          <strong>{target.record ? chineseReference('财务记录', target.record.id) : target.label}</strong>
          <span>{target.record?.version === null || target.record === undefined ? '按当前服务端范围执行' : `基于第 ${target.record.version} 版执行`}</span>
          <p>提交后会重新读取权威数据；重复点击使用同一幂等标识，不会重复执行。</p>
        </section>
        {target.kind === 'statementexport' ? <StatementFields model={model} /> : null}
        {target.kind === 'withdrawalcreate' ? <WithdrawalFields model={model} /> : null}
        {target.kind !== 'statementexport' && target.kind !== 'invoicecancel' ? (
          <label>业务原因<textarea value={draft.reason} maxLength={1000} rows={3} onChange={(event) => model.actions.reason(event.target.value)} placeholder="说明业务依据和预期结果" required /></label>
        ) : null}
        {proofRequired ? (
          <label>一次性操作凭证<input type="password" value={draft.proof} autoComplete="off" spellCheck={false} onChange={(event) => model.actions.proof(event.target.value)} placeholder="粘贴复核人签发的操作绑定凭证" required /></label>
        ) : null}
        <label className="financecommandconfirm"><input type="checkbox" checked={draft.confirmed} onChange={(event) => model.actions.confirmed(event.target.checked)} />我已核对操作对象、金额、版本和业务影响。</label>
        {editor.assurance < assuranceRequired ? <div className="financeactionstepup"><p>本操作要求更高强度的身份验证。</p><Button onPress={model.actions.stepup}>进行身份验证</Button></div> : null}
        {editor.error ? <p className="financeactionerror" role="alert">{editor.error}</p> : editor.validation ? <p className="financeactionvalidation">{editor.validation}</p> : null}
        <footer><Button onPress={model.actions.cancel} isDisabled={editor.busy}>取消</Button><Button type="submit" tone="primary" isDisabled={editor.busy || editor.validation !== undefined}>{editor.busy ? '正在执行并回读…' : `确认${target.label}`}</Button></footer>
      </form>
    </Dialog>
  );
}

function StatementFields({ model }: Readonly<{ model: SectionViewModel }>) {
  const draft = model.action!.draft;
  return <div className="financeactionfields">
    <label>开始日期<input type="date" value={draft.periodStart} onChange={(event) => model.actions.periodStart(event.target.value)} /></label>
    <label>结束日期<input type="date" value={draft.periodEnd} onChange={(event) => model.actions.periodEnd(event.target.value)} /></label>
    <label>币种<input value={draft.currency} maxLength={3} onChange={(event) => model.actions.currency(event.target.value)} placeholder="例如 CNY" /></label>
    <label>账单状态<select value={draft.statementState} onChange={(event) => model.actions.statementState(event.target.value as typeof draft.statementState)}><option value="">全部状态</option><option value="draft">草稿</option><option value="final">已定稿</option></select></label>
  </div>;
}

function WithdrawalFields({ model }: Readonly<{ model: SectionViewModel }>) {
  const draft = model.action!.draft;
  return <div className="financeactionfields">
    <label>结算单编号<input value={draft.settlement} onChange={(event) => model.actions.settlement(event.target.value)} placeholder="输入可提现结算单编号" required /></label>
    <label>提现金额（分）<input type="number" min="1" step="1" value={draft.amountMinor} onChange={(event) => model.actions.amountMinor(event.target.value)} required /></label>
    <label className="financeactionwide">收款目标引用<input value={draft.destinationRef} onChange={(event) => model.actions.destinationRef(event.target.value)} placeholder="输入服务端已登记的收款目标引用" required /></label>
  </div>;
}
