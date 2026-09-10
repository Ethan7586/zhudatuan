import { Dialog } from '@shop/design';
import { chineseDomainLabel, chineseProviderLabel } from '@shop/presentation';
import type { ChannelConnection, SyncKind } from '../model/Channel';
import type { ChannelActionViewModel } from '../viewmodel/ChannelActionViewModel';
import { ChannelDialogFooter } from './ChannelDialogFooter';
import { channelConnectionLabel } from './ChannelPresentation';
import { Review } from './ConnectionDialog';

export function ChannelActionDialog({ model, onClose }: Readonly<{ model: ChannelActionViewModel; onClose: () => void }>) {
  const action = model.action;
  if (!action || action.kind === 'create' || action.kind === 'update') return null;
  const title = titles[action.kind];
  return (
    <Dialog open title={title} eyebrow="权威操作 · 幂等执行 · 完成后重读" onClose={onClose} dismissable={!model.busy}>
      <form
        className="channeldialog"
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        {action.kind === 'startsync' ? <SyncFields model={model} connection={action.connection} /> : <p className="channelnotice">{description(model)}</p>}
        <Review model={model} text={impact(model)} />
        {model.error ? <p role="alert">{model.error}</p> : null}
        <ChannelDialogFooter busy={model.busy} blocked={Boolean(model.validation)} needsStepup={model.assurance < model.required} onClose={onClose} />
      </form>
    </Dialog>
  );
}

function SyncFields({ model, connection }: Readonly<{ model: ChannelActionViewModel; connection: ChannelConnection }>) {
  return (
    <>
      <section className="channelnotice" aria-label="本次同步连接">
        <strong>{channelConnectionLabel(connection)}</strong>
        <p>从所选连接发起同步；系统会在后台保存进度，离开页面不会中断任务。</p>
      </section>
      <label>
        同步类型
        <select value={model.syncKind} onChange={(event) => model.actions.syncKind(event.target.value as SyncKind)}>
          <option value="catalog">商品</option>
          <option value="price">价格</option>
          <option value="stock">库存</option>
          <option value="statement">账单</option>
        </select>
      </label>
      <label>
        续传游标（首次同步留空）
        <input value={model.cursor} onChange={(event) => model.actions.cursor(event.target.value)} />
      </label>
      {model.syncKind === 'statement' ? (
        <div className="channelgrid">
          <label>
            开始日期
            <input type="date" value={model.start} onChange={(event) => model.actions.start(event.target.value)} required />
          </label>
          <label>
            结束日期
            <input type="date" value={model.end} onChange={(event) => model.actions.end(event.target.value)} required />
          </label>
          <label>
            时区
            <input value={model.timezone} onChange={(event) => model.actions.timezone(event.target.value)} required />
          </label>
          <label>
            结算合作方业务编码
            <input value={model.partner} onChange={(event) => model.actions.partner(event.target.value)} required />
            <small>填写合作方提供的对账编码，不需要平台内部编号。</small>
          </label>
        </div>
      ) : null}
    </>
  );
}

const titles = Object.freeze({ test: '测试渠道连接', enable: '启用渠道连接', disable: '停用渠道连接', startsync: '启动同步任务', cancelsync: '取消同步任务', replay: '重放外部操作' });
function description(model: ChannelActionViewModel): string {
  const action = model.action!;
  if (action.kind === 'test') return `${channelConnectionLabel(action.connection)}将进入真实沙箱健康检查，不使用浏览器模拟结果。`;
  if (action.kind === 'enable') return `${channelConnectionLabel(action.connection)}将成为当前范围的启用连接；同服务商旧连接由服务端原子停用。`;
  if (action.kind === 'disable') return `${channelConnectionLabel(action.connection)}将停止接受新同步任务。`;
  if (action.kind === 'cancelsync') return `${channelConnectionLabel(action.sync)}的${chineseDomainLabel(action.sync.kind)}同步将被取消，已保存的进度不会回退。`;
  return `${action.kind === 'replay' ? chineseProviderLabel(action.operation.provider) : '服务商'}的外部操作将复用安全内部引用重新入队。`;
}
function impact(model: ChannelActionViewModel): string {
  const action = model.action!;
  return action.kind === 'startsync' ? `将为${channelConnectionLabel(action.connection)}启动${chineseDomainLabel(model.syncKind)}同步；进度只在数据持久化成功后推进。` : description(model);
}
