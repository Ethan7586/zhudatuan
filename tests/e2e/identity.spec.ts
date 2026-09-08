import { test } from '@playwright/test';
import { runStorefrontJourney } from './JourneyRuntime';

test('password registration', async ({ page }) => runStorefrontJourney(page, {
  scenario: 'password registration', path: '/profile/security', assertions: ['注册', '验证', '条款版本', '登录', 'Session', '注销'],
  operations: ['identity.session.read', 'identity.password.change', 'identity.session.delete'],
}));

test('invitation registration', async ({ page }) => runStorefrontJourney(page, {
  scenario: 'invitation registration', path: '/profile', assertions: ['邀请解析', '注册或登录', '接受', 'Scope', '回跳'],
  operations: ['identity.invitations.resolve', 'identity.invitations.read', 'identity.enrollments.read'],
}));

test('mobile challenge', async ({ page }) => runStorefrontJourney(page, {
  scenario: 'mobile challenge', path: '/profile/security', assertions: ['发送', '限速', '验证', '过期', '防枚举'],
  operations: ['identity.mobile.challenges.create', 'identity.mobile.manage'],
}));

test('multiple memberships', async ({ page }) => runStorefrontJourney(page, {
  scenario: 'multiple memberships', path: '/profile', assertions: ['身份选择', '身份切换', '权限立即更新', '导航立即更新'],
  operations: ['identity.memberships.read', 'identity.memberships.switch', 'navigation.catalog.read'],
}));

test('federation link', async ({ page }) => runStorefrontJourney(page, {
  scenario: 'federation link', path: '/profile/security', assertions: ['企业微信或微信绑定', '登录', '解绑', '冲突恢复'],
  operations: ['identity.providers.read', 'identity.links.read', 'identity.links.revoke'],
}));

test('session devices', async ({ page }) => runStorefrontJourney(page, {
  scenario: 'session devices', path: '/profile/security', assertions: ['查看设备', '撤销其他会话', 'Step-up'],
  operations: ['identity.sessions.read', 'identity.sessions.revoke', 'identity.stepup.start'],
}));
