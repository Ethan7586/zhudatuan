import { chineseDomainLabel } from '@shop/presentation';
import type { ConsoleNavigationNode, ConsoleScope } from '../../../entity/session/ConsoleSession';
import { SETTINGS_SECTIONS, settingsSectionForRoute } from '../../../shared/navigation/SettingsSection';
import { navigationPath } from '../../../shared/url/NavigationPath';
import type { SettingsWorkspace } from '../model/Settings';

export function createSettingsViewModel(nodes: readonly ConsoleNavigationNode[], scope: ConsoleScope, assurance: number): SettingsWorkspace {
  const modules = nodes
    .filter((node) => !node.experience.disabled && node.experience.placement !== 'contextual')
    .map((node) =>
      Object.freeze({
        id: node.key,
        title: node.title,
        component: node.experience.component,
        icon: node.experience.icon,
        description: moduleDescription(node.experience.component, node.title),
        href: navigationPath(node, scope),
        section: settingsSectionForRoute(node.experience.routeKey)?.id ?? 'system',
      })
    );
  const groups = SETTINGS_SECTIONS.flatMap((section) => {
    const entries = modules.filter((module) => module.section === section.id).map(({ section: _section, ...module }) => Object.freeze(module));
    return entries.length === 0 ? [] : [Object.freeze({ ...section, modules: Object.freeze(entries) })];
  });
  return Object.freeze({
    groups: Object.freeze(groups),
    moduleCount: modules.length,
    assurance: assurance >= 2 ? '已完成安全验证' : '敏感操作时再验证',
    scope: scope.name ?? chineseDomainLabel(scope.kind),
  });
}

const MODULE_DESCRIPTIONS: Readonly<Record<string, string>> = Object.freeze({
  access: '配置角色、管理范围和所有权交接。',
  approval: '配置需要复核的业务操作和审批规则。',
  member: '维护成员资料、状态和批量导入任务。',
  invitation: '创建邀请并跟踪受邀人的注册结果。',
  directory: '连接企业通讯录并查看同步结果。',
  partner: '管理供应商、门店和合作关系。',
  qualification: '维护商品经营所需的资格和有效期。',
  federation: '配置员工可使用的企业登录方式。',
  channel: '连接业务渠道并检查连接状态。',
  notification: '管理通知模板、公告和发送方式。',
  risk: '配置风险策略和异常处理规则。',
  control: '查看关键服务和依赖的运行状态。',
});

function moduleDescription(component: string, title: string): string {
  return MODULE_DESCRIPTIONS[component] ?? `管理${title}相关配置。`;
}
