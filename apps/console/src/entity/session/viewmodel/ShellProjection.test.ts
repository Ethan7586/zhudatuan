import { describe, expect, it } from 'vitest';
import type { ConsoleNavigationNode, ConsoleScope } from '../ConsoleSession';
import { projectScopes, projectShellNavigation } from './ShellProjection';

describe('shell projection', () => {
  it('projects searchable destinations and top-bar entries only from enabled navigation', () => {
    const notifications = node('message', '通知管理', 'notification', 'notification', '/messages', 'secondary');
    const detail = node('detail', '通知详情', 'notification', 'notification', '/messages/:messageId', 'contextual');
    const disabled = node('disabled', '停用入口', 'risk', 'risk', '/disabled', 'secondary', true);
    const root = { ...node('settings', '设置', 'settings', 'settings', '/settings', 'secondary'), children: [notifications, detail, disabled] };

    const result = projectShellNavigation([root]);

    expect(result.destinations.map(({ key }) => key)).toEqual(['settings', 'message']);
    expect(result.notification).toMatchObject({ key: 'message', route: '/messages' });
    expect(result.support).toBeUndefined();
    expect(Object.isFrozen(result.destinations)).toBe(true);
  });

  it('expresses the Bootstrap scope hierarchy without exposing the tenant anchor', () => {
    const platform = scope('platform', 'platform:one', '福利商城平台');
    const distributor = scope('distributor', 'distributor:one', '华东分销');
    const enterprise = scope('enterprise', 'enterprise:one', '鸿泰集团');
    const mall = scope('mall', 'mall:one', '喜悦商城', [
      { kind: 'platform', id: platform.id },
      { kind: 'distributor', id: distributor.id },
      { kind: 'tenant', id: 'tenant:one' },
      { kind: 'enterprise', id: enterprise.id },
    ]);

    const result = projectScopes(mall, [platform, distributor, enterprise, mall]);

    expect(result.label).toBe('商城 · 喜悦商城');
    expect(result.choices.map(({ label }) => label)).toEqual(['平台 · 福利商城平台', '分销 · 华东分销', '集团 · 鸿泰集团', '商城 · 喜悦商城']);
    expect(result.trail.map(({ label }) => label)).toEqual(['平台 · 福利商城平台', '分销 · 华东分销', '集团 · 鸿泰集团', '商城 · 喜悦商城']);
    expect(result.trail.at(-1)?.current).toBe(true);
  });
});

function node(key: string, title: string, icon: string, component: string, route: string, placement: 'primary' | 'secondary' | 'contextual', disabled = false): ConsoleNavigationNode {
  return {
    key,
    title,
    parent: null,
    order: 1,
    operation: 'navigation.test.read',
    experience: { icon, routeKey: key, route, component, placement, disabled, disabledReason: disabled ? '当前身份无此权限' : null, breadcrumbs: [{ key, title }] },
    children: [],
  };
}

function scope(kind: ConsoleScope['kind'], id: string, name: string, path?: ConsoleScope['path']): ConsoleScope {
  return { kind, id, name, ...(path === undefined ? {} : { path }) };
}
