import { AssurancePrompt } from '../../../entity/session/AssurancePrompt';
import type { SettingsViewModel, SupportSetting } from '../viewmodel/SettingsViewModel';
import { AccountSettings } from './AccountSettings';
import { AgentSettings } from './AgentSettings';
import { RuleSettings } from './RuleSettings';
import { SlaSettings } from './SlaSettings';

export function SupportSettings({ model }: Readonly<{ model: SettingsViewModel }>) {
  return (
    <section className="supportsettings">
      <nav role="tablist" aria-label="客服设置">
        {(['agents', 'accounts', 'rules', 'slas'] as const).map((value) => (
          <button type="button" key={value} role="tab" aria-selected={model.active === value} onClick={() => model.actions.select(value)}>
            {label(value)}
          </button>
        ))}
      </nav>
      {model.disabled ? (
        <AssurancePrompt title="验证后管理客服设置" description="客服人员、渠道密钥、分配规则与服务时限会影响用户服务，请先完成短信二次验证；验证后表单会在当前页面继续。" />
      ) : (
        <>
          {model.error ? <p className="supportactionerror" role="alert">{model.error}</p> : null}
          {model.notice ? <p className="supportsettingsnotice" role="status">{model.notice}</p> : null}
          {model.active === 'agents' ? (
            <AgentSettings rows={model.agents} busy={model.busy} disabled={false} onSave={(id, version, body) => model.actions.save({ kind: 'agents', id, version, body })} />
          ) : model.active === 'accounts' ? (
            <AccountSettings rows={model.accounts} busy={model.busy} disabled={false} onSave={(id, version, body) => model.actions.save({ kind: 'accounts', id, version, body })} />
          ) : model.active === 'rules' ? (
            <RuleSettings rows={model.rules} busy={model.busy} disabled={false} onSave={(id, version, body) => model.actions.save({ kind: 'rules', id, version, body })} />
          ) : (
            <SlaSettings rows={model.slas} busy={model.busy} disabled={false} onSave={(id, version, body) => model.actions.save({ kind: 'slas', id, version, body })} />
          )}
        </>
      )}
    </section>
  );
}

const label = (value: SupportSetting): string => ({ agents: '客服人员', accounts: '渠道账号', rules: '分配规则', slas: '服务时限' })[value];
