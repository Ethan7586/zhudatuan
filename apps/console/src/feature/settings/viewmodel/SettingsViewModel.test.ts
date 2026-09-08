import { describe, expect, it } from 'vitest';
import type { ConsoleNavigationNode, ConsoleScope } from '../../../entity/session/ConsoleSession';
import { createSettingsViewModel } from './SettingsViewModel';

describe('createSettingsViewModel', () => {
  it('exposes discoverable settings entries without trying to build contextual detail routes', () => {
    const scope = { kind: 'mall', id: 'mall:one', name: '员工商城' } as const satisfies ConsoleScope;
    const model = createSettingsViewModel(
      [
        node('approval', '/scopes/:scopeKind/:scopeId/settings/approvals', 'primary'),
        node('approvaltemplate', '/scopes/:scopeKind/:scopeId/settings/approvals/:templateId', 'contextual'),
      ],
      scope,
      2
    );
    expect(model.modules).toEqual([
      expect.objectContaining({ id: 'approval', href: '/scopes/mall/mall%3Aone/settings/approvals' }),
    ]);
  });
});

function node(key: string, route: string, placement: 'primary' | 'contextual'): ConsoleNavigationNode {
  return {
    key,
    title: key,
    parent: null,
    order: 1,
    operation: 'approval.templates.list',
    children: [],
    experience: { route, routeKey: key, component: 'settings', placement, disabled: false, disabledReason: null, icon: 'settings', breadcrumbs: [] },
  };
}
