import { Dialog } from '@shop/design';
import type { ChannelActionViewModel } from '../viewmodel/ChannelActionViewModel';
import { ChannelDialogFooter } from './ChannelDialogFooter';
import { ConnectionFields } from './ConnectionFields';

export function ConnectionDialog({ model, onClose }: Readonly<{ model: ChannelActionViewModel; onClose: () => void }>) {
  const action = model.action;
  if (action?.kind !== 'create' && action?.kind !== 'update') return null;
  const provider = model.providers.find(({ id }) => id === model.provider);
  return (
    <Dialog
      open
      title={action.kind === 'create' ? '创建渠道连接' : '更新渠道连接'}
      eyebrow="安全连接 · 完整配置替换 · 版本保护"
      description="只提交密钥引用，密钥值不会进入浏览器、日志或接口响应。"
      onClose={onClose}
      dismissable={!model.busy}
    >
      <form
        className="channeldialog"
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        {action.kind === 'update' ? (
          <p className="channelnotice">
            连接 {action.connection.id} · 当前版本 v{action.connection.version}。更新后回到草稿状态，必须重新完成真实连通性测试。
          </p>
        ) : null}
        <label>
          服务商
          {action.kind === 'update' ? (
            <strong>{provider?.name ?? model.provider}</strong>
          ) : (
            <select value={model.provider} onChange={(event) => model.actions.provider(event.target.value)}>
              {model.providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          )}
        </label>
        {provider ? (
          <section className="channelnotice" aria-label="渠道能力说明">
            <strong>{provider.business}</strong>
            <p>{provider.help}</p>
            <small>配置 Schema：{provider.form.schema} · 配置分组：{provider.settings.join('、')} · 能力：{provider.capabilities.join('、')}</small>
          </section>
        ) : null}
        <ConnectionFields model={model} updating={action.kind === 'update'} />
        <Review model={model} text={action.kind === 'create' ? `将在“${model.configuration.region ?? '待填写'}”区域创建 ${provider?.name ?? model.provider}连接。` : '将完整替换公开连接配置并使现有连接回到草稿状态；留空的密钥引用保持不变。'} />
        {model.error ? <p role="alert">{model.error}</p> : null}
        <ChannelDialogFooter busy={model.busy} blocked={Boolean(model.validation)} needsStepup={model.assurance < model.required} onClose={onClose} />
      </form>
    </Dialog>
  );
}

export function Review({ model, text }: Readonly<{ model: ChannelActionViewModel; text: string }>) {
  return (
    <section className="channelreview" aria-label="操作影响预览">
      <h3>影响预览</h3>
      <p>{text}</p>
      {model.required === 3 ? (
        <label>
          一次性复核凭证
          <input value={model.proof} onChange={(event) => model.actions.proof(event.target.value.trim())} autoComplete="off" spellCheck={false} />
        </label>
      ) : null}
      <label className="channelconfirm">
        <input type="checkbox" checked={model.confirmed} onChange={(event) => model.actions.confirmed(event.target.checked)} />
        <span>我已核对范围、目标与不可逆影响</span>
      </label>
      {model.assurance >= model.required && model.validation ? <p role="status">{model.validation}</p> : null}
    </section>
  );
}
