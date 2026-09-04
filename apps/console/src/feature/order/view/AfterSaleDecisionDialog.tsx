import { Button, Dialog } from '@shop/design';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { formatMinor } from '../../../shared/ui/Format';
import type { AfterSaleViewModel } from '../viewmodel/AfterSaleViewModel';

export function AfterSaleDecisionDialog({ model }: Readonly<{ model: AfterSaleViewModel }>) {
  const editor = model.editor;
  if (!editor) return null;
  const approve = editor.decision === 'approve';
  return (
    <Dialog open title={approve ? '批准售后申请' : '拒绝售后申请'} eyebrow="证据核对 · 乐观锁 · 决策留痕" onClose={model.actions.closeDecision} dismissable={!model.decision.busy}>
      <form className="orderwizardcontent" onSubmit={(event) => { event.preventDefault(); model.actions.submit(); }}>
        {model.decision.receipt ? (
          <section className="orderactionsuccess" role="status"><strong>售后决策已生效</strong><p>{chineseReference('售后单', model.decision.receipt.id)} 已进入“{chineseDomainLabel(model.decision.receipt.state)}”状态。</p><Button tone="primary" onPress={model.actions.closeDecision}>完成</Button></section>
        ) : (
          <>
            <section className="ordersnapshot"><h3>{chineseReference('售后单', editor.sale.id)}</h3><p>预计退款 {formatMinor(editor.sale.expectedRefundMinor, editor.sale.currency)}；{editor.sale.requiresReturn ? '批准后需要退货' : '批准后无需退货'}；共 {editor.sale.lines.length} 个申请行、{editor.sale.attachments.length} 份附件。</p></section>
            <label>审核依据<textarea rows={4} maxLength={1000} value={editor.reason} onChange={(event) => model.actions.reason(event.target.value)} placeholder="说明核对的订单行、附件、退款金额和判断依据" /></label>
            <label className="orderactionconfirm"><input type="checkbox" checked={editor.confirmed} onChange={(event) => model.actions.confirmed(event.target.checked)} />我已核对申请范围、证据、退款分解和退货要求，并理解该决定将进入审计记录。</label>
            {model.assurance < 3 ? <Button onPress={model.actions.stepup}>完成高强度二次验证</Button> : null}
            {model.decision.error ? <p role="alert">{model.decision.error}</p> : model.decision.validation ? <p>{model.decision.validation}</p> : null}
            <footer><Button onPress={model.actions.closeDecision} isDisabled={model.decision.busy}>取消</Button><Button type="submit" tone="primary" isDisabled={model.decision.busy || model.decision.validation !== undefined}>{model.decision.busy ? '正在提交…' : approve ? '批准并继续处理' : '拒绝申请'}</Button></footer>
          </>
        )}
      </form>
    </Dialog>
  );
}
