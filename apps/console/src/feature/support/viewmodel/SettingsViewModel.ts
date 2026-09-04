import { hasFailureCode, safeQueryError } from '@shop/presentation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { SupportDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { AccountChange, AgentChange, RuleChange, SlaChange } from '../model/SupportConfig';
import { settingKey } from './SupportQueryKey';

export type SupportSetting = 'agents' | 'accounts' | 'rules' | 'slas';
export type SupportSettingChange =
  | Readonly<{ kind: 'agents'; id: string; version: number; body: AgentChange }>
  | Readonly<{ kind: 'accounts'; id: string; version: number; body: AccountChange }>
  | Readonly<{ kind: 'rules'; id: string; version: number; body: RuleChange }>
  | Readonly<{ kind: 'slas'; id: string; version: number; body: SlaChange }>;

export function useSettingsViewModel(context: ConsoleContext, dependencies: SupportDependencies, enabled: boolean) {
  const cache = useQueryClient();
  const [active, setActive] = useState<SupportSetting>('agents');
  const [notice, setNotice] = useState('');
  const agents = useQuery({ queryKey: settingKey(context, 'agents'), queryFn: ({ signal }) => dependencies.port.agents(context, undefined, signal), enabled });
  const accounts = useQuery({ queryKey: settingKey(context, 'accounts'), queryFn: ({ signal }) => dependencies.port.accounts(context, undefined, signal), enabled });
  const rules = useQuery({ queryKey: settingKey(context, 'rules'), queryFn: ({ signal }) => dependencies.port.rules(context, undefined, signal), enabled });
  const slas = useQuery({ queryKey: settingKey(context, 'slas'), queryFn: ({ signal }) => dependencies.port.slas(context, undefined, signal), enabled });
  const mutation = useMutation<void, Error, SupportSettingChange>({
    mutationFn: async (change) => {
      if (change.kind === 'agents') await dependencies.manageConfig.agent(context, change.id, change.version, change.body);
      else if (change.kind === 'accounts') await dependencies.manageConfig.account(context, change.id, change.version, change.body);
      else if (change.kind === 'rules') await dependencies.manageConfig.rule(context, change.id, change.version, change.body);
      else await dependencies.manageConfig.sla(context, change.id, change.version, change.body);
    },
    onSuccess: async (_, change) => {
      setNotice('配置已保存并取得新版本。');
      await cache.invalidateQueries({ queryKey: settingKey(context, change.kind) });
    },
    onError: async (cause, change) => {
      const conflict = hasFailureCode(cause, 'VERSION_CONFLICT');
      setNotice(conflict ? '配置已被其他管理员修改。表单内容已保留，列表已加载服务器新版本，请核对后重新提交。' : '配置保存失败，请检查输入和连接状态后重试。');
      if (conflict) await cache.invalidateQueries({ queryKey: settingKey(context, change.kind) });
    },
  });
  const actions = useMemo(
    () =>
      Object.freeze({
        select: (value: SupportSetting) => {
          setActive(value);
          mutation.reset();
          setNotice('');
        },
        save: (change: SupportSettingChange) => {
          if (!mutation.isPending) mutation.mutate(change);
        },
      }),
    [mutation]
  );
  return Object.freeze({
    active,
    notice,
    disabled: context.session.assurance.level < 3,
    busy: mutation.isPending,
    error: safeQueryError(mutation.error),
    agents: agents.data?.items ?? [],
    accounts: accounts.data?.items ?? [],
    rules: rules.data?.items ?? [],
    slas: slas.data?.items ?? [],
    actions,
  });
}

export type SettingsViewModel = ReturnType<typeof useSettingsViewModel>;
