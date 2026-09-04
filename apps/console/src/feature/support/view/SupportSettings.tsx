import { Button, ResourceState } from '@shop/design';
import { AssurancePrompt } from '../../../entity/session/AssurancePrompt';
import { useStepup } from '../../../entity/session/StepupContext';
import type { SettingsViewModel, SupportSetting } from '../viewmodel/SettingsViewModel';
import { AccountSettings } from './AccountSettings';
import { AgentSettings } from './AgentSettings';
import { RuleSettings } from './RuleSettings';
import { SlaSettings } from './SlaSettings';

export function SupportSettings({ model }: Readonly<{ model: SettingsViewModel }>) {
  const stepup = useStepup();
  return (
    <section className="supportsettings">
      <div role="tablist" aria-label="客服设置">
        {model.available.map((value) => (
          <button type="button" key={value} role="tab" aria-selected={model.active === value} onClick={() => model.actions.select(value)}>
            {label(value)}
          </button>
        ))}
      </div>
      {model.available.length === 0 ? (
        <section className="supportsettingempty">
          <h2>当前账号没有客服设置查看权限</h2>
          <p>可返回客服工作台继续处理已授权的工单。</p>
        </section>
      ) : model.readVerificationRequired ? (
        <AssurancePrompt title="验证后查看客服设置" description="客服人员、渠道账号、分配规则与服务时限属于受保护信息，请先完成短信二次验证；验证后当前页会自动加载。" />
      ) : (
        <ResourceState condition={model.condition} {...(model.readError ? { error: model.readError } : {})} retry={model.actions.retry}>
          {model.error ? (
            <p className="supportactionerror" role="alert">
              {model.error}
            </p>
          ) : null}
          {model.notice ? (
            <p className="supportsettingsnotice" role="status">
              {model.notice}
            </p>
          ) : null}
          {model.writeVerificationRequired ? <div className="supportsettingsverify" role="status"><span>当前配置可查看；完成高强度身份验证后可编辑。</span><Button onPress={stepup.request}>验证后编辑</Button></div> : !model.editable ? <p className="supportsettingsnotice" role="status">当前配置为只读；如需修改，请联系管理员授予对应配置权限。</p> : null}
          {model.active === 'agents' ? (
            <AgentSettings rows={model.agents} busy={model.busy} disabled={!model.editable} onSave={(id, version, body) => model.actions.save({ kind: 'agents', id, version, body })} />
          ) : model.active === 'accounts' ? (
            <AccountSettings rows={model.accounts} busy={model.busy} disabled={!model.editable} onSave={(id, version, body) => model.actions.save({ kind: 'accounts', id, version, body })} />
          ) : model.active === 'rules' ? (
            <RuleSettings rows={model.rules} busy={model.busy} disabled={!model.editable} onSave={(id, version, body) => model.actions.save({ kind: 'rules', id, version, body })} />
          ) : (
            <SlaSettings rows={model.slas} busy={model.busy} disabled={!model.editable} onSave={(id, version, body) => model.actions.save({ kind: 'slas', id, version, body })} />
          )}
        </ResourceState>
      )}
    </section>
  );
}

const label = (value: SupportSetting): string => ({ agents: '客服人员', accounts: '渠道账号', rules: '分配规则', slas: '服务时限' })[value];
