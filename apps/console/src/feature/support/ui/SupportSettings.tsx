import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { hasFailureCode, safeQueryError } from '@shop/presentation';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { AssurancePrompt } from '../../../entity/session/AssurancePrompt';
import { ManageSupportConfig } from '../application/ManageSupportConfig';
import type { SupportGateway } from '../infrastructure/SupportGateway';
import type { AccountChange, AgentChange, RuleChange, SlaChange } from '../model/SupportConfig';
import { AccountSettings } from './AccountSettings';
import { AgentSettings } from './AgentSettings';
import { RuleSettings } from './RuleSettings';
import { SlaSettings } from './SlaSettings';

type Setting = 'agents' | 'accounts' | 'rules' | 'slas';
type Change =
  | Readonly<{ kind: 'agents'; id: string; version: number; body: AgentChange }>
  | Readonly<{ kind: 'accounts'; id: string; version: number; body: AccountChange }>
  | Readonly<{ kind: 'rules'; id: string; version: number; body: RuleChange }>
  | Readonly<{ kind: 'slas'; id: string; version: number; body: SlaChange }>;

export function SupportSettings({ gateway }: Readonly<{ gateway: SupportGateway }>) {
  const context = useConsoleContext();
  const cache = useQueryClient();
  const manager = new ManageSupportConfig(gateway);
  const [active, setActive] = useState<Setting>('agents');
  const [notice, setNotice] = useState('');
  const agents = useQuery({ queryKey: supportSettingKey(context.scope.id, context.session.accessVersion, 'agents'), queryFn: ({ signal }) => gateway.agents(context, undefined, signal) });
  const accounts = useQuery({ queryKey: supportSettingKey(context.scope.id, context.session.accessVersion, 'accounts'), queryFn: ({ signal }) => gateway.accounts(context, undefined, signal) });
  const rules = useQuery({ queryKey: supportSettingKey(context.scope.id, context.session.accessVersion, 'rules'), queryFn: ({ signal }) => gateway.rules(context, undefined, signal) });
  const slas = useQuery({ queryKey: supportSettingKey(context.scope.id, context.session.accessVersion, 'slas'), queryFn: ({ signal }) => gateway.slas(context, undefined, signal) });
  const mutation = useMutation<void, Error, Change>({
    mutationFn: async (change) => { if (change.kind === 'agents') await manager.agent(context, change.id, change.version, change.body); else if (change.kind === 'accounts') await manager.account(context, change.id, change.version, change.body); else if (change.kind === 'rules') await manager.rule(context, change.id, change.version, change.body); else await manager.sla(context, change.id, change.version, change.body); },
    onSuccess: async (_, change) => { setNotice('配置已保存并取得新版本。'); await cache.invalidateQueries({ queryKey: supportSettingKey(context.scope.id, context.session.accessVersion, change.kind) }); },
    onError: async (cause, change) => { const conflict = hasFailureCode(cause, 'VERSION_CONFLICT'); setNotice(conflict ? '配置已被其他管理员修改。表单内容已保留，列表已加载服务器新版本，请核对后重新提交。' : '配置保存失败，请检查输入和连接状态后重试。'); if (conflict) await cache.invalidateQueries({ queryKey: supportSettingKey(context.scope.id, context.session.accessVersion, change.kind) }); },
  });
  const disabled = context.session.assurance.level < 3;
  const error = safeQueryError(mutation.error);
  return <section className="supportsettings"><nav role="tablist" aria-label="客服设置">{(['agents', 'accounts', 'rules', 'slas'] as const).map((value) => <button type="button" key={value} role="tab" aria-selected={active === value} onClick={() => { setActive(value); mutation.reset(); setNotice(''); }}>{label(value)}</button>)}</nav>{disabled ? <AssurancePrompt title="验证后管理客服设置" description="客服人员、渠道密钥、分配规则与 SLA 会影响用户服务，请先完成短信二次验证；验证后表单会在当前页面继续。" /> : <>{error ? <p className="supportactionerror" role="alert">{error}</p> : null}{notice ? <p className="supportsettingsnotice" role="status">{notice}</p> : null}{active === 'agents' ? <AgentSettings rows={agents.data?.items ?? []} busy={mutation.isPending} disabled={false} onSave={(id, version, body) => mutation.mutate({ kind: 'agents', id, version, body })} /> : active === 'accounts' ? <AccountSettings rows={accounts.data?.items ?? []} busy={mutation.isPending} disabled={false} onSave={(id, version, body) => mutation.mutate({ kind: 'accounts', id, version, body })} /> : active === 'rules' ? <RuleSettings rows={rules.data?.items ?? []} busy={mutation.isPending} disabled={false} onSave={(id, version, body) => mutation.mutate({ kind: 'rules', id, version, body })} /> : <SlaSettings rows={slas.data?.items ?? []} busy={mutation.isPending} disabled={false} onSave={(id, version, body) => mutation.mutate({ kind: 'slas', id, version, body })} />}</>}</section>;
}

const supportSettingKey = (scope: string, version: number, setting: Setting) => ['console', scope, version, 'support.settings', setting] as const;
const label = (value: Setting): string => ({ agents: '客服人员', accounts: '渠道账号', rules: '分配规则', slas: 'SLA' })[value];
