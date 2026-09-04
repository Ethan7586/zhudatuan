import { Dialog } from '@shop/design';
import type { SyncKind } from '../model/Channel';
import type { ChannelActionViewModel } from '../viewmodel/ChannelActionViewModel';
import { ChannelDialogFooter } from './ChannelDialogFooter';
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
        {action.kind === 'startsync' ? <SyncFields model={model} /> : <p className="channelnotice">{description(model)}</p>}
        <Review model={model} text={impact(model)} />
        {model.error ? <p role="alert">{model.error}</p> : null}
        <ChannelDialogFooter busy={model.busy} blocked={Boolean(model.validation)} needsStepup={model.assurance < model.required} onClose={onClose} />
      </form>
    </Dialog>
  );
}

function SyncFields({ model }: Readonly<{ model: ChannelActionViewModel }>) {
  return (
    <>
      <label>
        连接编号
        <input value={model.connection} onChange={(event) => model.actions.connection(event.target.value)} required />
      </label>
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
            合作方编号
            <input value={model.partner} onChange={(event) => model.actions.partner(event.target.value)} required />
          </label>
        </div>
      ) : null}
    </>
  );
}

const titles = Object.freeze({ test: '测试渠道连接', enable: '启用渠道连接', disable: '停用渠道连接', startsync: '启动同步任务', cancelsync: '取消同步任务', replay: '重放外部操作' });
function description(model: ChannelActionViewModel): string {
  const action = model.action!;
  if (action.kind === 'test') return `连接 ${action.connection.id} 将进入真实沙箱健康检查，不使用浏览器模拟结果。`;
  if (action.kind === 'enable') return `连接 ${action.connection.id} 将成为当前范围的启用连接；同服务商旧连接由服务端原子停用。`;
  if (action.kind === 'disable') return `连接 ${action.connection.id} 将停止接受新同步任务。`;
  if (action.kind === 'cancelsync') return `同步任务 ${action.sync.id} 将基于版本 v${action.sync.version} 取消，已持久化的水位不会回退。`;
  return `外部操作 ${action.kind === 'replay' ? action.operation.id : ''} 将复用原内部引用重新入队。`;
}
function impact(model: ChannelActionViewModel): string {
  const action = model.action!;
  return action.kind === 'startsync' ? `将为连接 ${model.connection || '（待填写）'} 启动 ${model.syncKind} 同步；游标只在数据持久化成功后推进。` : description(model);
}
