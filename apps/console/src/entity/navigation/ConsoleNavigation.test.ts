import { SCOPE_KINDS } from '@shop/authz';
import { describe, expect, it } from 'vitest';
import type { ConsoleModuleManifest } from './ConsoleModuleManifest';
import { consoleModules } from '../../route/ConsoleModuleRegistry';
import { selectConsoleNavigationItems } from './ConsoleNavigation';

describe('Console navigation selector', () => {
  it('derives the 11 ordinary main items and bottom support in navigation order', () => {
    const items = selectConsoleNavigationItems(consoleModules, 'enterprise');

    expect(items.filter(({ placement }) => placement === 'main').map(({ moduleId, label, icon, order }) => ({ moduleId, label, icon, order }))).toEqual([
      { moduleId: 'cockpit', label: '经营驾驶舱', icon: 'trend', order: 10 },
      { moduleId: 'reports', label: '数据报表', icon: 'trend', order: 15 },
      { moduleId: 'control', label: '主打团中控台', icon: 'control', order: 20 },
      { moduleId: 'applications', label: '築店 · 商城管理', icon: 'building', order: 30 },
      { moduleId: 'products', label: '商品治理台', icon: 'products', order: 40 },
      { moduleId: 'orders', label: '订单管理系统', icon: 'orders', order: 50 },
      { moduleId: 'referral', label: '分销返佣系统', icon: 'channel', order: 60 },
      { moduleId: 'channels', label: '渠道接入系统', icon: 'channel', order: 70 },
      { moduleId: 'vouchers', label: '卡券治理台', icon: 'voucher', order: 80 },
      { moduleId: 'finance', label: '财务与对账台', icon: 'finance', order: 90 },
      { moduleId: 'access', label: '会员与权限', icon: 'members', order: 100 },
      { moduleId: 'qualification', label: '系统治理台', icon: 'system', order: 110 },
    ]);
    expect(items.filter(({ placement }) => placement === 'bottom')).toEqual([
      expect.objectContaining({ moduleId: 'support', suffix: 'support', label: '客服系统', icon: 'support', order: 130 }),
    ]);
    expect(items.find(({ moduleId }) => moduleId === 'control')).toBeUndefined();
    expect(items.find(({ moduleId }) => moduleId === 'referral')).toMatchObject({
      suffix: 'referral/settings', preferredScopeKind: 'mall', status: 'enabled',
    });
  });

  it('uses manifest scope labels for every Console scope kind', () => {
    for (const scopeKind of SCOPE_KINDS) {
      const label = selectConsoleNavigationItems(consoleModules, scopeKind)
        .find(({ moduleId }) => moduleId === 'applications')?.label;
      if (scopeKind === 'platform' || scopeKind === 'distributor' || scopeKind === 'tenant') {
        expect(label).toBe('应用治理');
      } else if (scopeKind === 'mall') {
        expect(label).toBe('店铺装修');
      } else {
        expect(label).toBe('商城管理');
      }
    }
  });

  it('shows the merchant service center only in the platform scope', () => {
    expect(selectConsoleNavigationItems(consoleModules, 'platform')
      .find(({ moduleId }) => moduleId === 'control')).toMatchObject({
      suffix: 'control', label: '商家服务中心', placement: 'main', order: 20,
    });
    expect(selectConsoleNavigationItems(consoleModules, 'mall')
      .find(({ moduleId }) => moduleId === 'control')).toBeUndefined();
  });

  it('keeps disabled navigable, omits hidden, and emits restored reports navigation', () => {
    const modules = withStatus('products', 'disabled', withStatus('channels', 'hidden', consoleModules));
    const items = selectConsoleNavigationItems(modules, 'enterprise');

    expect(items.find(({ moduleId }) => moduleId === 'products')).toMatchObject({ status: 'disabled', suffix: 'products' });
    expect(items.find(({ moduleId }) => moduleId === 'channels')).toBeUndefined();
    expect(items.find(({ moduleId }) => moduleId === 'reports')).toMatchObject({
      status: 'enabled', suffix: 'reports', placement: 'main', order: 15,
    });
  });

  it('shows only modules whose entry operation is available to the current session', () => {
    const items = selectConsoleNavigationItems(consoleModules, 'enterprise', ['catalog.listings.read', 'support.cases.read']);

    expect(items.map(({ moduleId }) => moduleId)).toEqual(['products', 'support']);
  });
});

function withStatus(
  moduleId: ConsoleModuleManifest['id'],
  status: ConsoleModuleManifest['status'],
  modules: readonly ConsoleModuleManifest[],
): readonly ConsoleModuleManifest[] {
  return modules.map((module) => module.id === moduleId ? { ...module, status } : module);
}
