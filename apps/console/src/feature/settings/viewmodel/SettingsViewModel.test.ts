import { describe, expect, it } from 'vitest';
import type { ConsoleNavigationNode, ConsoleScope } from '../../../entity/session/ConsoleSession';
import { createSettingsViewModel } from './SettingsViewModel';

describe('createSettingsViewModel', () => {
  it('groups discoverable settings by the generated route authority without exposing contextual detail routes', () => {
    const scope = { kind: 'mall', id: 'mall:one', name: '员工商城' } as const satisfies ConsoleScope;
    const model = createSettingsViewModel(
      [
        node('admin', '权限中心', 'consoleaccess', '/scopes/:scopeKind/:scopeId/settings/access', 'secondary', 'access'),
        node('message', '通知管理', 'consolenotifications', '/scopes/:scopeKind/:scopeId/settings/messages', 'secondary', 'notification'),
        node('control', '系统运行', 'consolecontrol', '/scopes/:scopeKind/:scopeId/control', 'secondary', 'control'),
        node('approvaltemplate', '审批模板', 'consoleapprovaltemplate', '/scopes/:scopeKind/:scopeId/settings/approvals/:templateId', 'contextual', 'approval'),
      ],
      scope,
      2
    );
    expect(model.moduleCount).toBe(3);
    expect(model.groups.map(({ id, title }) => ({ id, title }))).toEqual([
      { id: 'organization', title: '组织与人员' },
      { id: 'connections', title: '连接' },
      { id: 'system', title: '系统' },
    ]);
    expect(model.groups[0]?.modules).toEqual([expect.objectContaining({ id: 'admin', title: '权限中心', href: '/scopes/mall/mall%3Aone/settings/access' })]);
    expect(model.groups.flatMap(({ modules }) => modules).some(({ id }) => id === 'approvaltemplate')).toBe(false);
    expect(model.assurance).toBe('已完成安全验证');
  });
});

function node(key: string, title: string, routeKey: ConsoleNavigationNode['experience']['routeKey'], route: string, placement: 'secondary' | 'contextual', component: string): ConsoleNavigationNode {
  return {
    key,
    title,
    parent: null,
    order: 1,
    operation: 'approval.templates.list',
    children: [],
    experience: { route, routeKey, component, placement, disabled: false, disabledReason: null, icon: 'settings', breadcrumbs: [] },
  };
}
