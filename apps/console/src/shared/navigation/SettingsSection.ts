import { ROUTE_GROUPS, type RouteId } from '../../generated/RouteBinding';

export type SettingsSectionId = 'organization' | 'resources' | 'connections' | 'security' | 'system';

export interface SettingsSectionDefinition {
  readonly id: SettingsSectionId;
  readonly title: string;
  readonly description: string;
}

export const SETTINGS_SECTIONS: readonly SettingsSectionDefinition[] = Object.freeze([
  Object.freeze({ id: 'organization', title: '组织与人员', description: '管理成员、邀请、角色权限、审批和企业通讯录。' }),
  Object.freeze({ id: 'resources', title: '业务资源', description: '管理供应商、门店以及商品经营资格。' }),
  Object.freeze({ id: 'connections', title: '连接', description: '管理登录方式、渠道连接和消息通知。' }),
  Object.freeze({ id: 'security', title: '安全', description: '管理风险策略以及敏感操作的安全边界。' }),
  Object.freeze({ id: 'system', title: '系统', description: '查看服务运行状态和基础系统能力。' }),
]);

const SETTINGS_SECTION_BY_ID: ReadonlyMap<string, SettingsSectionDefinition> = new Map(SETTINGS_SECTIONS.map((section) => [section.id, section]));

export function settingsSectionForRoute(routeKey: string): SettingsSectionDefinition | null {
  if (!(routeKey in ROUTE_GROUPS)) return null;
  const group = ROUTE_GROUPS[routeKey as RouteId];
  return group === null ? null : (SETTINGS_SECTION_BY_ID.get(group) ?? null);
}
