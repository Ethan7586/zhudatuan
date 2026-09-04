import { Button, Dialog } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import type { AfterSaleViewModel } from '../viewmodel/AfterSaleViewModel';

export function AfterSaleReturnDialog({ model }: Readonly<{ model: AfterSaleViewModel }>) {
  const editor = model.returnEditor;
  if (!editor) return null;
  const receiving = editor.kind === 'receive';
  return (
    <Dialog open title={receiving ? '登记退货收货' : '登记退货质检'} eyebrow="退货聚合 · 版本校验 · 状态单调" onClose={model.actions.closeReturn} dismissable={!model.returnCommand.busy}>
      <form className="orderwizardcontent" onSubmit={(event) => { event.preventDefault(); model.actions.submitReturn(); }}>
        {model.returnCommand.receipt ? (
          <section className="orderactionsuccess" role="status"><strong>{receiving ? '退货包裹已登记收货' : '退货质检结论已登记'}</strong><p>{chineseReference('退货单', model.returnCommand.receipt.id)} 已进入“{model.returnCommand.receipt.state}”。</p><Button tone="primary" onPress={model.actions.closeReturn}>完成</Button></section>
        ) : (
          <>
            <section className="ordersnapshot"><strong>{editor.sale.orderNumber}</strong><p>{chineseReference('售后单', editor.sale.id)} · {chineseReference('退货单', editor.target.id)} · 当前第 {editor.target.version} 版</p></section>
            {receiving ? <label>完整物流单号（选填）<input value={editor.tracking} maxLength={128} onChange={(event) => model.actions.returnTracking(event.target.value)} placeholder={editor.target.trackingMasked ?? '扫描或输入包裹物流单号'} /></label> : <><fieldset><legend>质检结论</legend><label><input type="radio" name="returnresult" checked={editor.accepted} onChange={() => model.actions.returnAccepted(true)} />验收通过，进入退款</label><label><input type="radio" name="returnresult" checked={!editor.accepted} onChange={() => model.actions.returnAccepted(false)} />验收不通过，转人工处理</label></fieldset><label>质检依据<textarea rows={4} maxLength={1000} value={editor.note} onChange={(event) => model.actions.returnNote(event.target.value)} placeholder="记录外观、数量、配件、包装及照片证据编号" /></label></>}
            <label className="orderactionconfirm"><input type="checkbox" checked={editor.confirmed} onChange={(event) => model.actions.returnConfirmed(event.target.checked)} />{receiving ? '我已核对退货包裹、售后单和物流信息。' : '我已核对商品状态、验收结论和相关证据。'}</label>
            {model.assurance < 2 ? <Button onPress={model.actions.stepup}>完成二次验证</Button> : null}
            {model.returnCommand.error ? <p role="alert">{model.returnCommand.error}</p> : model.returnCommand.validation ? <p>{model.returnCommand.validation}</p> : null}
            <footer><Button onPress={model.actions.closeReturn} isDisabled={model.returnCommand.busy}>取消</Button><Button type="submit" tone="primary" isDisabled={model.returnCommand.busy || model.returnCommand.validation !== undefined}>{model.returnCommand.busy ? '正在提交…' : receiving ? '确认退货收货' : '提交质检结论'}</Button></footer>
          </>
        )}
      </form>
    </Dialog>
  );
}
