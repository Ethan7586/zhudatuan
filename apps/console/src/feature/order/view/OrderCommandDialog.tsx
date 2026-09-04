import { Button, Dialog } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import type { OrderCommandEditor, DetailViewModel } from '../viewmodel/DetailViewModel';

const copy = Object.freeze({
  cancel: { title: '取消待付款订单', eyebrow: '状态转换 · 版本校验 · 不可恢复', description: '仅能取消尚未支付且尚未履约的订单；服务端会再次核对支付与订单版本。', success: '订单已取消', submit: '确认取消订单' },
  receive: { title: '确认订单收货', eyebrow: '状态转换 · 版本校验 · 完整审计', description: '确认后履约状态单调推进为已收货；服务端会用订单版本防止并发覆盖。', success: '订单已确认收货', submit: '确认收货' },
  remind: { title: '提醒履约方处理', eyebrow: '去重提醒 · 异步通知', description: '提醒只会排入通知任务，不改变订单、支付或履约状态。', success: '履约提醒已排队', submit: '发送提醒' },
  ship: { title: '登记订单发货', eyebrow: '真实履约 · 物流证据 · 幂等提交', description: '系统会创建独立包裹并记录不可篡改的物流轨迹；订单中的其他履约单不受影响。', success: '发货事实已登记', submit: '登记发货' },
  refund: { title: '提交订单退款', eyebrow: '金额上限 · 经办复核 · 原路退回', description: '退款按支付资金来源拆分并异步原路退回；提交后不能通过界面撤销。', success: '退款任务已受理', submit: '提交退款' },
  recovery: { title: '处理支付恢复事项', eyebrow: '错误证据 · 经办复核 · 可追踪任务', description: '请选择与故障证据一致的恢复方式；系统保留原失败任务，不覆盖历史事实。', success: '恢复请求已受理', submit: '提交恢复' },
} as const);

export function OrderCommandDialog({ model }: Readonly<{ model: DetailViewModel }>) {
  const editor = model.editor;
  if (!editor) return null;
  const content = copy[editor.kind];
  return (
    <Dialog open title={content.title} eyebrow={content.eyebrow} onClose={model.actions.closeCommand} dismissable={!model.command.busy}>
      <form className="orderwizardcontent" onSubmit={(event) => { event.preventDefault(); model.actions.submit(); }}>
        {model.command.receipt ? (
          <section className="orderactionsuccess" role="status">
            <strong>{content.success}</strong>
            <p>{chineseReference('服务端收据', model.command.receipt.id)}{'requestId' in model.command.receipt && model.command.receipt.requestId ? `；${chineseReference('任务请求', model.command.receipt.requestId)}` : ''}</p>
            <Button tone="primary" onPress={model.actions.closeCommand}>完成</Button>
          </section>
        ) : (
          <>
            <p>{content.description}</p>
            <OrderCommandFields editor={editor} model={model} />
            <label className="orderactionconfirm"><input type="checkbox" checked={editor.confirmed} onChange={(event) => model.actions.confirmed(event.target.checked)} />{confirmation(editor.kind)}</label>
            {requiresStepup(editor.kind, model.assurance) ? <Button onPress={model.actions.stepup}>{editor.kind === 'refund' || editor.kind === 'recovery' ? '完成高强度二次验证' : '完成二次验证'}</Button> : null}
            {model.command.error ? <p role="alert">{model.command.error}</p> : model.command.validation ? <p>{model.command.validation}</p> : null}
            <footer><Button onPress={model.actions.closeCommand} isDisabled={model.command.busy}>取消</Button><Button type="submit" tone="primary" isDisabled={model.command.busy || model.command.validation !== undefined}>{model.command.busy ? '正在提交…' : content.submit}</Button></footer>
          </>
        )}
      </form>
    </Dialog>
  );
}

function OrderCommandFields({ editor, model }: Readonly<{ editor: OrderCommandEditor; model: DetailViewModel }>) {
  if (editor.kind === 'cancel') return <label>取消原因<textarea rows={3} maxLength={1000} value={editor.reason} onChange={(event) => model.actions.reason(event.target.value)} placeholder="例如：收货信息有误，需要重新下单" /></label>;
  if (editor.kind === 'receive') return <label>确认依据<textarea rows={3} maxLength={500} value={editor.reason} onChange={(event) => model.actions.reason(event.target.value)} placeholder="例如：已核对签收回执与物流送达时间" /></label>;
  if (editor.kind === 'remind') return null;
  if (editor.kind === 'ship') return <><section className="ordersnapshot"><strong>{chineseReference('履约单', editor.fulfillment?.id ?? '')}</strong><p>只推进当前履约单，不会把整笔订单误判为全部发货。</p></section><label>物流单号<input value={editor.tracking} maxLength={128} onChange={(event) => model.actions.tracking(event.target.value)} placeholder="扫描或输入承运方物流单号" /></label><label>承运方（选填）<input value={editor.carrier} maxLength={64} onChange={(event) => model.actions.carrier(event.target.value)} placeholder="例如：顺丰、京东物流" /></label></>;
  if (editor.kind === 'refund') return <><label>退款金额（元）<input inputMode="decimal" value={editor.amountMinor} onChange={(event) => model.actions.amountMinor(event.target.value)} aria-describedby="orderrefundlimit" /></label><p id="orderrefundlimit">当前最多可退 ¥{((model.data?.payment.refundableMinor ?? 0) / 100).toFixed(2)}，金额由服务端再次校验。</p><label>退款依据<textarea rows={3} maxLength={500} value={editor.reason} onChange={(event) => model.actions.reason(event.target.value)} placeholder="说明退款范围、业务依据和已核对证据" /></label><ProofField editor={editor} model={model} /></>;
  return <><section className="ordersnapshot"><strong>{chineseReference('恢复事项', editor.recovery?.id ?? '')}</strong><p>错误代码：{editor.recovery?.errorCode ?? '—'}；已出现 {editor.recovery?.occurrenceCount ?? 0} 次。</p></section><label>恢复方式<select value={editor.recoveryAction} onChange={(event) => model.actions.recoveryAction(event.target.value as OrderCommandEditor['recoveryAction'])}><option value="requery">重新查询支付结果</option><option value="retryrefund">重试原退款</option><option value="replay">重放原失败任务</option><option value="resolve">仅标记人工已解决</option></select></label><label>处理依据<textarea rows={3} maxLength={500} value={editor.reason} onChange={(event) => model.actions.reason(event.target.value)} placeholder="说明证据核对结果和选择该恢复方式的原因" /></label><ProofField editor={editor} model={model} /></>;
}

function ProofField({ editor, model }: Readonly<{ editor: OrderCommandEditor; model: DetailViewModel }>) {
  return <label>一次性复核凭证<input value={editor.proof} autoComplete="off" spellCheck={false} onChange={(event) => model.actions.proof(event.target.value)} placeholder="粘贴另一位复核人签发的操作凭证" /></label>;
}

function requiresStepup(kind: OrderCommandEditor['kind'], assurance: number): boolean {
  return kind === 'refund' || kind === 'recovery' ? assurance < 3 : (kind === 'cancel' || kind === 'receive' || kind === 'ship') && assurance < 2;
}

function confirmation(kind: OrderCommandEditor['kind']): string {
  return ({ cancel: '我已确认本单尚未支付、尚未履约，并了解取消后不能恢复。', receive: '我已核对物流事实，确认该订单已完成收货。', remind: '我已确认当前订单仍需履约，且近期没有重复催单。', ship: '我已核对履约对象、物流单号和承运方，确认登记真实发货事实。', refund: '我已核对可退上限、退款依据和复核凭证，确认提交原路退款。', recovery: '我已核对错误证据、恢复方式和复核凭证，确认不会重复执行外部动作。' } as const)[kind];
}
