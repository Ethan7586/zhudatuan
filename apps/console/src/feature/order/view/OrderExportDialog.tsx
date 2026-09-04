import { Button, Dialog } from '@shop/design';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { formatOrderTime } from './OrderPresentation';
import type { ListViewModel } from '../viewmodel/ListViewModel';

export function OrderExportDialog({ model }: Readonly<{ model: ListViewModel }>) {
  if (!model.exporting.open) return null;
  const result = model.exporting.result;
  return (
    <Dialog open title="安全导出订单" eyebrow="冻结条件 · 授权快照 · 数据水印" onClose={model.actions.closeExport} dismissable={!model.exporting.busy}>
      <div className="orderactiondialog">
        {result ? (
          <section className="orderactionsuccess" role="status">
            <strong>导出任务已进入安全队列</strong>
            <p>导出只包含提交时授权范围内且不晚于水印的订单，后续数据变更不会改变本次文件。</p>
            <dl><div><dt>任务编号</dt><dd>{chineseReference('导出任务', result.id)}</dd></div><div><dt>冻结水印</dt><dd>{formatOrderTime(result.watermark)}</dd></div></dl>
            <Button tone="primary" onPress={model.actions.closeExport}>完成</Button>
          </section>
        ) : (
          <form className="orderwizardcontent" onSubmit={(event) => { event.preventDefault(); model.actions.submitExport(); }}>
            <section className="ordersnapshot">
              <h3>本次导出条件</h3>
              <p>{filterSummary(model.exporting.filter)}</p>
            </section>
            <p>服务端会同时冻结操作者、Scope、权限版本、筛选条件和数据库水印；文件经扫描后生成限时下载地址。</p>
            <label className="orderactionconfirm"><input type="checkbox" checked={model.exporting.confirmed} onChange={(event) => model.actions.exportConfirmed(event.target.checked)} />我确认本次导出用于授权业务目的，并会按敏感数据规范保存。</label>
            {model.exporting.error ? <p role="alert">{model.exporting.error}</p> : null}
            <footer><Button onPress={model.actions.closeExport} isDisabled={model.exporting.busy}>取消</Button><Button type="submit" tone="primary" isDisabled={model.exporting.busy || !model.exporting.confirmed}>{model.exporting.busy ? '正在冻结快照…' : '创建安全导出'}</Button></footer>
          </form>
        )}
      </div>
    </Dialog>
  );
}

function filterSummary(filter: ListViewModel['filter']): string {
  const values = [filter.search && `搜索“${filter.search}”`, filter.placed && `时间 ${chineseDomainLabel(filter.placed)}`, filter.lifecycle && `进度 ${chineseDomainLabel(filter.lifecycle)}`, filter.payment && `支付 ${chineseDomainLabel(filter.payment)}`, filter.fulfillment && `履约 ${chineseDomainLabel(filter.fulfillment)}`, filter.mall && '指定商城', filter.channel && '指定渠道', filter.product && '指定商品', filter.member && '指定成员', filter.minimumMinor && `最低 ${filter.minimumMinor} 分`, filter.maximumMinor && `最高 ${filter.maximumMinor} 分`].filter(Boolean);
  return values.length ? values.join('；') : '当前 Scope 内的全部可见订单';
}
