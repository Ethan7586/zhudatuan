import type { ProviderConfigField } from '@shop/contract';
import type { ChannelActionViewModel } from '../viewmodel/ChannelActionViewModel';

export function ConnectionFields({ model, updating }: Readonly<{ model: ChannelActionViewModel; updating: boolean }>) {
  const fields = model.registration?.form.fields ?? [];
  const basics = fields.filter((field) => field.kind !== 'endpoint');
  const endpoints = fields.filter((field) => field.kind === 'endpoint');
  return <>
    <div className="channelgrid">{basics.map((field) => <ConnectionField key={field.key} field={field} model={model} updating={updating} />)}</div>
    {endpoints.length ? <fieldset className="channelendpoints"><legend>服务商能力端点</legend><p>以下字段由扩展配置 Schema 自动生成，每项都对应一个已声明的可执行能力。</p><div className="channelgrid">{endpoints.map((field) => <ConnectionField key={field.key} field={field} model={model} updating={updating} />)}</div></fieldset> : <p className="channelnotice">该扩展使用平台内置受控适配器，无需填写远程地址、端点或密钥。</p>}
  </>;
}

function ConnectionField({ field, model, updating }: Readonly<{ field: ProviderConfigField; model: ChannelActionViewModel; updating: boolean }>) {
  const optional = updating && field.kind === 'secretref';
  return <label className={field.kind === 'endpoint' ? 'channelendpoint' : undefined}>
    {field.label}{optional ? '（可留空）' : ''}
    <input
      type={field.kind === 'url' ? 'url' : 'text'}
      value={model.configuration[field.key] ?? ''}
      onChange={(event) => model.actions.field(field.key, event.target.value)}
      placeholder={field.placeholder}
      autoComplete="off"
      spellCheck={false}
      required={field.required && !optional}
    />
    <small>{optional ? '留空将保留当前密钥引用；填写后会安全轮换引用。' : field.help}</small>
  </label>;
}
