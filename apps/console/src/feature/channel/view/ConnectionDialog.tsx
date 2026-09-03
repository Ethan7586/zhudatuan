import { Dialog } from '@shop/design';
import { channelProviders } from '../model/Channel';
import type { ChannelActionViewModel } from '../viewmodel/ChannelActionViewModel';
import { ChannelDialogFooter } from './ChannelDialogFooter';

export function ConnectionDialog({ model, onClose }: Readonly<{ model: ChannelActionViewModel; onClose: () => void }>) {
  const action = model.action;
  if (action?.kind !== 'create' && action?.kind !== 'update') return null;
  const supplier = model.provider === 'supplier';
  return <Dialog open title={action.kind === 'create' ? '创建渠道连接' : '更新渠道连接'} eyebrow="安全连接 · 完整配置替换 · 版本保护" description="只提交密钥引用，密钥值不会进入浏览器、日志或接口响应。" onClose={onClose} dismissable={!model.busy}>
    <form className="channeldialog" onSubmit={(event) => { event.preventDefault(); model.actions.submit(); }}>
      {action.kind === 'update' ? <p className="channelnotice">连接 {action.connection.id} · 当前版本 v{action.connection.version}。更新后回到草稿状态，必须重新完成真实连通性测试。</p> : null}
      <label>服务商{action.kind === 'update' ? <strong>{channelProviders.find(({ id }) => id === model.provider)?.label ?? model.provider}</strong> : <select value={model.provider} onChange={(event) => model.actions.provider(event.target.value)}>{channelProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}</select>}</label>
      <div className="channelgrid"><label>部署区域<input value={model.region} onChange={(event) => model.actions.region(event.target.value)} placeholder="cn" required /></label><label>健康检查操作<input value={model.healthOperation} onChange={(event) => model.actions.healthOperation(event.target.value)} readOnly={supplier} required /></label></div>
      {!supplier ? <><label>服务地址<input type="url" value={model.baseUrl} onChange={(event) => model.actions.baseUrl(event.target.value)} placeholder="https://provider.example.com" autoComplete="off" required /></label><label>密钥引用<input value={model.secretRef} onChange={(event) => model.actions.secretRef(event.target.value)} placeholder="vault:channel/credential" autoComplete="off" spellCheck={false} required /><small>填写密钥管理系统中的引用；禁止粘贴 API Key、口令或私钥原文。</small></label><label>操作端点 JSON<textarea value={model.endpoints} onChange={(event) => model.actions.endpoints(event.target.value)} spellCheck={false} rows={7} required /><small>键为服务商操作名，值必须是“/”开头的相对路径；至少包含健康检查操作。</small></label></> : <p className="channelnotice">自有供应商使用本地适配器，无远程地址、端点和密钥。</p>}
      <Review model={model} text={action.kind === 'create' ? `将在“${model.region}”区域创建 ${model.provider} 连接。` : '将完整替换连接配置并使现有连接回到草稿状态。'} />
      {model.error ? <p role="alert">{model.error}</p> : null}<ChannelDialogFooter busy={model.busy} blocked={Boolean(model.validation)} needsStepup={model.assurance < model.required} onClose={onClose} />
    </form>
  </Dialog>;
}

export function Review({ model, text }: Readonly<{ model: ChannelActionViewModel; text: string }>) {
  return <section className="channelreview" aria-label="操作影响预览"><h3>影响预览</h3><p>{text}</p>{model.required === 3 ? <label>一次性复核凭证<input value={model.proof} onChange={(event) => model.actions.proof(event.target.value.trim())} autoComplete="off" spellCheck={false} /></label> : null}<label className="channelconfirm"><input type="checkbox" checked={model.confirmed} onChange={(event) => model.actions.confirmed(event.target.checked)} /><span>我已核对范围、目标与不可逆影响</span></label>{model.assurance >= model.required && model.validation ? <p role="status">{model.validation}</p> : null}</section>;
}
